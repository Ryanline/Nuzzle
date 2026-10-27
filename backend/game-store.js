import crypto from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import {
  encounterPokemon,
  itemById,
  itemCatalog,
  learnableMoveIds,
  natureNames,
  pokemonById,
  pokemonCatalog,
  starterPokemon,
} from "./content.js";
import { generateEncounterMoves } from "./movesets.js";
import { gameDate } from "./game-clock.js";

const require = createRequire(import.meta.url);
const { Dex, toID } = require("pokemon-showdown");
const stats = ["hp", "atk", "def", "spa", "spd", "spe"];
const statLabels = { hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" };
const startingMoney = 50000;
const victoryReward = 15000;
const directTrainingVersion = 1;

function gameError(message, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode });
}

function randomChoice(values) {
  return values[crypto.randomInt(values.length)];
}

function randomGender(species) {
  if (species.gender) return species.gender;
  return crypto.randomInt(1_000_000) < Math.round((species.genderRatio?.M ?? 0.5) * 1_000_000) ? "M" : "F";
}

function defaultMoves(speciesId) {
  if (speciesId === "ditto") return ["Transform", "Transform", "Transform", "Transform"];
  if (speciesId === "unown") return ["Hidden Power", "Hidden Power", "Hidden Power", "Hidden Power"];
  return generateEncounterMoves(speciesId);
}

function createPokemon(speciesData) {
  const ivs = Object.fromEntries(stats.map((stat) => [stat, crypto.randomInt(32)]));
  const evs = Object.fromEntries(stats.map((stat) => [stat, 0]));
  const ability = randomChoice(speciesData.ordinaryAbilities);
  return {
    id: speciesData.id,
    encounterFamilyId: speciesData.encounterFamilyId,
    speciesId: speciesData.id,
    name: speciesData.name,
    spriteId: speciesData.spriteId,
    types: [...speciesData.types],
    level: 100,
    ivs,
    evs,
    nature: randomChoice(natureNames),
    ability,
    gender: randomGender(speciesData),
    shiny: crypto.randomInt(4096) === 0,
    heldItemId: speciesData.id === "snorlax" ? "leftovers" : null,
    moves: defaultMoves(speciesData.id),
  };
}

function weightedPokemon(pool, blockedFamilies) {
  const eligible = pool.filter((pokemon) => !blockedFamilies.has(pokemon.encounterFamilyId));
  if (!eligible.length) gameError("No eligible Pokémon remain in the encounter pool.", 409);
  const total = eligible.reduce((sum, pokemon) => sum + pokemon.encounterWeight, 0);
  let roll = (crypto.randomInt(0x1000000) / 0x1000000) * total;
  for (const pokemon of eligible) {
    roll -= pokemon.encounterWeight;
    if (roll < 0) return pokemon;
  }
  return eligible.at(-1);
}

function generateBatch(run, count, guaranteeStarter, reservedFamilies) {
  const generated = [];
  for (let index = 0; index < count; index++) {
    const pool = guaranteeStarter && index === 0 ? starterPokemon : encounterPokemon;
    const species = weightedPokemon(pool, reservedFamilies);
    generated.push(createPokemon(species));
    reservedFamilies.add(species.encounterFamilyId);
  }
  return generated;
}

function encounterCount(date) {
  return new Date(`${date}T12:00:00Z`).getUTCDay() === 0 ? 4 : 3;
}

function ensureDaily(run, date) {
  if (run.daily?.date === date) return;
  if (run.daily?.encounters.some((encounter) => encounter.kind === "opening" && !encounter.claimed)) return;
  const reserved = new Set(run.roster.map((pokemon) => pokemon.encounterFamilyId));
  const opening = run.roster.length === 0 && !run.openingBatchClaimed;
  const total = opening ? 12 : encounterCount(date);
  const encounters = [];
  for (let slot = 0; slot < total; slot++) {
    encounters.push({
      kind: opening ? "opening" : "single",
      claimed: false,
      pokemon: generateBatch(run, 1, opening && slot === 0 && run.starterGuarantee, reserved),
    });
  }
  run.daily = { date, encounters };
  if (opening) run.starterGuarantee = false;
}

function migrateOpeningEncounters(run) {
  if (!run.daily?.encounters?.some((encounter) => encounter.kind === "opening" && encounter.pokemon.length > 1)) return;
  run.daily.encounters = run.daily.encounters.flatMap((encounter) => encounter.kind === "opening"
    ? encounter.pokemon.map((pokemon) => ({ kind: "opening", claimed: encounter.claimed, pokemon: [pokemon] }))
    : [encounter]);
}

function natureAdjustment(natureName, stat) {
  const nature = Dex.natures.get(natureName);
  if (nature.plus === stat) return 1.1;
  if (nature.minus === stat) return 0.9;
  return 1;
}

function calculatedStats(pokemon) {
  const species = pokemonById.get(pokemon.speciesId);
  return Object.fromEntries(stats.map((stat) => {
    const base = species.baseStats[stat];
    const core = Math.floor(((2 * base + pokemon.ivs[stat] + Math.floor(pokemon.evs[stat] / 4)) * pokemon.level) / 100);
    const value = stat === "hp" ? (base === 1 ? 1 : core + pokemon.level + 10) : Math.floor((core + 5) * natureAdjustment(pokemon.nature, stat));
    return [stat, value];
  }));
}

function trainingItem(effect, predicate = () => true) {
  return itemCatalog.find((item) => item.effect === effect && predicate(item));
}

function migrateDirectTraining(run) {
  if ((run.directTrainingVersion || 0) >= directTrainingVersion) return;
  for (const [itemId, quantity] of Object.entries(run.inventory || {})) {
    const item = itemById.get(itemId);
    if (!item || !["Training Items", "TMs"].includes(item.group)) continue;
    run.money += item.price * quantity;
    delete run.inventory[itemId];
  }
  run.directTrainingVersion = directTrainingVersion;
}

function formChangeItem(pokemon, speciesId) {
  if (pokemon.speciesId === speciesId) return null;
  if (pokemon.speciesId.startsWith("rotom") && speciesId.startsWith("rotom")) return trainingItem("rotom");
  return trainingItem("form", (item) => item.target === speciesId);
}

function legalMoveIds(speciesId) {
  try {
    return new Set(Dex.species.getFullLearnset(speciesId).flatMap(({ learnset }) => Object.keys(learnset)));
  } catch {
    return new Set();
  }
}

function buildTrainingQuote(pokemon, proposed = {}) {
  const speciesId = String(proposed.speciesId || pokemon.speciesId);
  const species = pokemonById.get(speciesId);
  if (!species || species.encounterFamilyId !== pokemon.encounterFamilyId) gameError("Choose a valid form for this Pokémon.");

  const ivs = {};
  const evs = {};
  for (const stat of stats) {
    const iv = Number(proposed.ivs?.[stat] ?? pokemon.ivs[stat]);
    const ev = Number(proposed.evs?.[stat] ?? pokemon.evs[stat]);
    if (!Number.isInteger(iv) || iv < 0 || iv > 31) gameError(`${statLabels[stat]} IV must be from 0 to 31.`);
    if (!Number.isInteger(ev) || ev < 0 || ev > 252) gameError(`${statLabels[stat]} EV must be from 0 to 252.`);
    ivs[stat] = iv;
    evs[stat] = ev;
  }
  if (Object.values(evs).reduce((sum, value) => sum + value, 0) > 510) gameError("A Pokémon cannot have more than 510 total EVs.");

  const nature = Dex.natures.get(String(proposed.nature || pokemon.nature));
  if (!nature.exists) gameError("Choose a valid nature.");
  const ability = String(proposed.ability || pokemon.ability);
  const eligibleAbilities = [...species.ordinaryAbilities, species.hiddenAbility].filter(Boolean);
  if (!eligibleAbilities.includes(ability)) gameError(`${ability || "That ability"} is not available to ${species.name}.`);

  const moves = Array.isArray(proposed.moves) ? proposed.moves.map((move) => Dex.moves.get(String(move)).name) : [...pokemon.moves];
  if (moves.length !== pokemon.moves.length || moves.some((move) => !move)) gameError(`Choose exactly ${pokemon.moves.length} valid moves.`);
  if (!["ditto", "unown"].includes(speciesId) && new Set(moves.map(toID)).size !== moves.length) gameError("A Pokémon cannot know the same move twice.");
  const learnable = legalMoveIds(speciesId);
  for (const move of moves) {
    if (!learnable.has(toID(move))) gameError(`${species.name} cannot learn ${move}.`);
  }

  const lineItems = [];
  for (const stat of stats) {
    const difference = evs[stat] - pokemon.evs[stat];
    if (difference > 0) {
      const item = trainingItem("ev", (candidate) => candidate.stat === stat && candidate.amount > 0);
      lineItems.push({ key: `ev-${stat}`, label: `${statLabels[stat]} EV +${difference}`, quantity: difference, unitPrice: item.price, cost: difference * item.price });
    } else if (difference < 0) {
      lineItems.push({ key: `ev-${stat}`, label: `${statLabels[stat]} EV −${Math.abs(difference)}`, quantity: Math.abs(difference), unitPrice: 0, cost: 0 });
    }
    if (ivs[stat] !== pokemon.ivs[stat]) {
      const raising = ivs[stat] > pokemon.ivs[stat];
      const cost = raising ? trainingItem("iv").price : 0;
      lineItems.push({ key: `iv-${stat}`, label: `${statLabels[stat]} IV ${pokemon.ivs[stat]} → ${ivs[stat]}`, quantity: 1, unitPrice: cost, cost });
    }
  }
  if (nature.name !== pokemon.nature) {
    const item = trainingItem("nature");
    lineItems.push({ key: "nature", label: `Nature ${pokemon.nature} → ${nature.name}`, quantity: 1, unitPrice: item.price, cost: item.price });
  }
  if (ability !== pokemon.ability) {
    const effect = ability === species.hiddenAbility ? "ability-patch" : "ability-capsule";
    const item = trainingItem(effect);
    lineItems.push({ key: "ability", label: `Ability ${pokemon.ability} → ${ability}`, quantity: 1, unitPrice: item.price, cost: item.price });
  }
  if (speciesId !== pokemon.speciesId) {
    const item = formChangeItem(pokemon, speciesId);
    if (!item) gameError(`That form change is not available for ${pokemon.name}.`);
    lineItems.push({ key: "form", label: `Form ${pokemon.name} → ${species.name}`, quantity: 1, unitPrice: item.price, cost: item.price });
  }
  const knownMoveIds = new Set(pokemon.moves.map(toID));
  for (const move of moves) {
    const moveId = toID(move);
    if (knownMoveIds.has(moveId)) continue;
    const item = itemById.get(`tm-${moveId}`);
    if (!item) gameError(`${move} is not available for training.`);
    lineItems.push({ key: `move-${moveId}`, label: `Learn ${move}`, quantity: 1, unitPrice: item.price, cost: item.price });
  }

  const normalized = { speciesId, ivs, evs, nature: nature.name, ability, moves };
  const preview = { ...pokemon, ...normalized, name: species.name, level: pokemon.level };
  const changed = speciesId !== pokemon.speciesId
    || nature.name !== pokemon.nature
    || ability !== pokemon.ability
    || stats.some((stat) => ivs[stat] !== pokemon.ivs[stat] || evs[stat] !== pokemon.evs[stat])
    || moves.some((move, slot) => move !== pokemon.moves[slot]);
  return {
    build: normalized,
    calculatedStats: calculatedStats(preview),
    lineItems,
    total: lineItems.reduce((sum, item) => sum + item.cost, 0),
    changed,
  };
}

function pokemonView(pokemon) {
  const species = pokemonById.get(pokemon.speciesId);
  const values = calculatedStats(pokemon);
  return {
    ...structuredClone(pokemon),
    ordinaryAbilities: [...species.ordinaryAbilities],
    hiddenAbility: species.hiddenAbility,
    baseStats: { ...species.baseStats },
    calculatedStats: values,
    hp: `100.0% (${values.hp}/${values.hp})`,
    stats: stats.filter((stat) => stat !== "hp").map((stat) => `${statLabels[stat]} ${values[stat]}`).join(" / "),
    moveDetails: pokemon.moves.map((name) => {
      const move = Dex.moves.get(name);
      return {
        name,
        type: move.exists ? move.type : "Normal",
        category: move.exists ? move.category : "Status",
        power: move.exists && move.category !== "Status" && move.basePower > 0 ? move.basePower : null,
      };
    }),
    learnableMoveIds: [...learnableMoveIds(pokemon.speciesId)],
    legalMoveIds: [...legalMoveIds(pokemon.speciesId)],
    trainingForms: pokemonCatalog
      .filter((candidate) => candidate.encounterFamilyId === pokemon.encounterFamilyId)
      .map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        baseStats: { ...candidate.baseStats },
        ordinaryAbilities: [...candidate.ordinaryAbilities],
        hiddenAbility: candidate.hiddenAbility,
        learnableMoveIds: [...learnableMoveIds(candidate.id)],
        legalMoveIds: [...legalMoveIds(candidate.id)],
      })),
    item: pokemon.heldItemId ? itemById.get(pokemon.heldItemId)?.name || "None" : "None",
  };
}

function newRun(userId, month = null) {
  return {
    id: crypto.randomUUID(),
    userId,
    createdAt: new Date().toISOString(),
    month,
    money: startingMoney,
    roster: [],
    teamIds: [],
    inventory: {},
    purchasedUnique: [],
    openingBatchClaimed: false,
    starterGuarantee: true,
    daily: null,
    directTrainingVersion,
    trainingTransactions: [],
  };
}

function availableItemCount(run, itemId, excludingPokemonId = null) {
  const equipped = run.roster.filter((pokemon) => pokemon.id !== excludingPokemonId && pokemon.heldItemId === itemId).length;
  return (run.inventory[itemId] || 0) - equipped;
}

export class GameStore {
  constructor(filename, { timeZone = process.env.NUZZLE_TIME_ZONE || "America/New_York", now = () => new Date() } = {}) {
    this.filename = filename;
    this.timeZone = timeZone;
    this.now = now;
    this.data = { version: 2, runs: {} };
    this.pending = Promise.resolve();
    this.writeSequence = 0;
  }

  async initialize() {
    await mkdir(path.dirname(this.filename), { recursive: true });
    try {
      this.data = JSON.parse(await readFile(this.filename, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await this.save();
    }
  }

  async save() {
    const sequence = ++this.writeSequence;
    const temporary = `${this.filename}.${process.pid}.${sequence}.tmp`;
    await writeFile(temporary, `${JSON.stringify(this.data, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, this.filename);
  }

  async mutate(userId, operation) {
    let result;
    this.pending = this.pending.catch(() => {}).then(async () => {
      const date = gameDate(this.now(), this.timeZone);
      const month = date.slice(0, 7);
      let run = this.data.runs[userId] ||= newRun(userId, month);
      migrateOpeningEncounters(run);
      if (!run.month) run.month = month;
      if (run.month !== month) run = this.data.runs[userId] = newRun(userId, month);
      migrateDirectTraining(run);
      ensureDaily(run, date);
      result = operation(run);
      await this.save();
    });
    await this.pending;
    return result;
  }

  publicState(run) {
    const encounters = run.daily.encounters.map((encounter, slot) => ({
      slot,
      kind: encounter.kind,
      count: encounter.pokemon.length,
      claimed: encounter.claimed,
      pokemon: encounter.claimed ? encounter.pokemon.map(pokemonView) : null,
    }));
    return {
      runId: run.id,
      date: run.daily.date,
      money: run.money,
      roster: run.roster.map(pokemonView),
      teamIds: [...run.teamIds],
      inventory: { ...run.inventory },
      purchasedUnique: [...run.purchasedUnique],
      encounters,
      battleUnlocked: run.teamIds.length > 0,
    };
  }

  async get(userId) {
    return this.mutate(userId, (run) => this.publicState(run));
  }

  async claimEncounter(userId, slot) {
    return this.mutate(userId, (run) => {
      const encounter = run.daily.encounters[slot];
      if (!encounter) gameError("Encounter not found.", 404);
      if (encounter.claimed) return this.publicState(run);
      encounter.claimed = true;
      for (const pokemon of encounter.pokemon) {
        if (run.roster.some((owned) => owned.encounterFamilyId === pokemon.encounterFamilyId)) gameError("That encounter conflicts with an owned Pokémon.", 409);
        run.roster.push(pokemon);
        if (pokemon.heldItemId === "leftovers") run.inventory.leftovers = (run.inventory.leftovers || 0) + 1;
      }
      if (encounter.kind === "opening") {
        run.openingBatchClaimed = run.daily.encounters.every((candidate) => candidate.claimed);
      }
      if (encounter.kind === "opening" && run.teamIds.length < 6) {
        for (const pokemon of encounter.pokemon) {
          if (run.teamIds.length < 6 && !run.teamIds.includes(pokemon.id)) run.teamIds.push(pokemon.id);
        }
      } else if (!run.teamIds.length) run.teamIds = run.roster.slice(0, 6).map((pokemon) => pokemon.id);
      return this.publicState(run);
    });
  }

  async setTeam(userId, teamIds) {
    return this.mutate(userId, (run) => {
      if (!Array.isArray(teamIds) || teamIds.length > 6 || new Set(teamIds).size !== teamIds.length) gameError("Choose up to six different Pokémon.");
      if (teamIds.some((id) => !run.roster.some((pokemon) => pokemon.id === id))) gameError("The team contains a Pokémon you do not own.");
      run.teamIds = [...teamIds];
      return this.publicState(run);
    });
  }

  async buy(userId, itemId, quantity = 1) {
    return this.mutate(userId, (run) => {
      const item = itemById.get(itemId);
      quantity = Number(quantity);
      if (!item) gameError("Item not found.", 404);
      if (item.group !== "Held Items") gameError("Training changes are purchased directly from the PC.", 409);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) gameError("Choose a quantity from 1 to 999.");
      if (item.purchaseLimit === 1 && (run.purchasedUnique.includes(item.id) || quantity !== 1)) gameError(`${item.name} may only be purchased once per run.`, 409);
      const cost = item.price * quantity;
      if (run.money < cost) gameError("You do not have enough coins.", 409);
      run.money -= cost;
      run.inventory[item.id] = (run.inventory[item.id] || 0) + quantity;
      if (item.purchaseLimit === 1) run.purchasedUnique.push(item.id);
      return this.publicState(run);
    });
  }

  async equip(userId, pokemonId, itemId) {
    return this.mutate(userId, (run) => {
      const pokemon = run.roster.find((candidate) => candidate.id === pokemonId);
      const item = itemById.get(itemId);
      if (!pokemon) gameError("Pokémon not found.", 404);
      if (!item || item.group !== "Held Items") gameError("That is not a held item.");
      if (pokemon.heldItemId === itemId) gameError(`${pokemon.name} is already holding ${item.name}.`, 409);
      if (availableItemCount(run, itemId, pokemon.id) < 1) gameError(`No unequipped ${item.name} is available.`, 409);
      pokemon.heldItemId = itemId;
      return this.publicState(run);
    });
  }

  async unequip(userId, pokemonId) {
    return this.mutate(userId, (run) => {
      const pokemon = run.roster.find((candidate) => candidate.id === pokemonId);
      if (!pokemon) gameError("Pokémon not found.", 404);
      if (!pokemon.heldItemId) gameError(`${pokemon.name} is not holding an item.`, 409);
      pokemon.heldItemId = null;
      return this.publicState(run);
    });
  }

  async applyBattleItemAcquisitions(userId, battleId, acquisitions = []) {
    return this.mutate(userId, (run) => {
      run.settledItemBattleIds ||= [];
      if (run.settledItemBattleIds.includes(battleId)) return this.publicState(run);
      for (const acquisition of acquisitions) {
        const pokemon = run.roster.find((candidate) => candidate.id === acquisition.pokemonId);
        const item = itemById.get(acquisition.itemId);
        if (!pokemon || pokemon.heldItemId || !item || item.group !== "Held Items") continue;
        run.inventory[item.id] = (run.inventory[item.id] || 0) + 1;
        pokemon.heldItemId = item.id;
      }
      run.settledItemBattleIds.push(battleId);
      return this.publicState(run);
    });
  }

  async settleBattle(userId, battleId, { acquisitions = [], faintedPokemonIds = [], won = false } = {}) {
    return this.mutate(userId, (run) => {
      run.settledBattleIds ||= [];
      if (run.settledBattleIds.includes(battleId)) return this.publicState(run);
      for (const acquisition of acquisitions) {
        const pokemon = run.roster.find((candidate) => candidate.id === acquisition.pokemonId);
        const item = itemById.get(acquisition.itemId);
        if (!pokemon || pokemon.heldItemId || !item || item.group !== "Held Items") continue;
        run.inventory[item.id] = (run.inventory[item.id] || 0) + 1;
        pokemon.heldItemId = item.id;
      }
      const fainted = new Set(faintedPokemonIds);
      run.roster = run.roster.filter((pokemon) => !fainted.has(pokemon.id));
      run.teamIds = run.teamIds.filter((id) => !fainted.has(id));
      if (won) run.money += victoryReward;
      run.settledBattleIds.push(battleId);
      return this.publicState(run);
    });
  }

  async resetAfterWipe(userId, battleId) {
    return this.mutate(userId, (run) => {
      if (run.resetFromBattleId === battleId) return this.publicState(run);
      const replacement = newRun(userId, run.month);
      replacement.resetFromBattleId = battleId;
      replacement.daily = { date: run.daily.date, encounters: [] };
      this.data.runs[userId] = replacement;
      return this.publicState(replacement);
    });
  }

  async useTrainingItem(userId, pokemonId, itemId, options = {}) {
    return this.mutate(userId, (run) => {
      let pokemon = run.roster.find((candidate) => candidate.id === pokemonId);
      const item = itemById.get(itemId);
      if (!pokemon) gameError("Pokémon not found.", 404);
      if (!item || !["Training Items", "TMs"].includes(item.group)) gameError("That item cannot be used for training.");
      if ((run.inventory[item.id] || 0) < 1) gameError(`You do not own ${item.name}.`, 409);
      let used = 1;
      if (item.effect === "ev") {
        const requested = Math.max(1, Math.min(999, Number(options.quantity) || 1));
        const owned = run.inventory[item.id];
        const total = Object.values(pokemon.evs).reduce((sum, value) => sum + value, 0);
        const legal = item.amount > 0 ? Math.min(252 - pokemon.evs[item.stat], 510 - total) : pokemon.evs[item.stat];
        used = Math.min(requested, owned, legal);
        if (used < 1) gameError(`${pokemon.name}'s ${statLabels[item.stat]} EV cannot change in that direction.`, 409);
        pokemon.evs[item.stat] += item.amount * used;
      } else if (item.effect === "iv") {
        const stat = String(options.stat || "");
        const value = Number(options.value ?? 31);
        if (!stats.includes(stat) || !Number.isInteger(value) || value < 0 || value > 31) gameError("Choose a stat and an IV from 0 to 31.");
        if (pokemon.ivs[stat] === value) gameError("That IV already has the selected value.", 409);
        pokemon.ivs[stat] = value;
      } else if (item.effect === "nature") {
        const nature = Dex.natures.get(String(options.nature || ""));
        if (!nature.exists) gameError("Choose a valid nature.");
        if (pokemon.nature === nature.name) gameError(`${pokemon.name} already has that nature.`, 409);
        pokemon.nature = nature.name;
      } else if (item.effect === "ability-capsule") {
        const species = pokemonById.get(pokemon.speciesId);
        const choices = species.ordinaryAbilities.filter((ability) => ability !== pokemon.ability);
        if (!choices.length) gameError(`Ability Capsule cannot change ${pokemon.name}'s ability.`, 409);
        const requested = options.ability && choices.includes(options.ability) ? options.ability : choices.length === 1 ? choices[0] : null;
        if (!requested) gameError("Choose an ordinary ability.");
        pokemon.ability = requested;
      } else if (item.effect === "ability-patch") {
        const hidden = pokemonById.get(pokemon.speciesId).hiddenAbility;
        if (!hidden || pokemon.ability === hidden) gameError(`Ability Patch cannot change ${pokemon.name}'s ability.`, 409);
        pokemon.ability = hidden;
      } else if (item.effect === "rotom") {
        const forms = ["rotom", "rotomheat", "rotomwash", "rotomfrost", "rotomfan", "rotommow"];
        const target = String(options.form || "");
        if (!pokemon.speciesId.startsWith("rotom") || !forms.includes(target)) gameError("Choose a valid Rotom form.");
        if (pokemon.speciesId === target) gameError("Rotom already has that form.", 409);
        pokemon = this.changeForm(run, pokemon, target);
      } else if (item.effect === "form") {
        const target = pokemonById.get(item.target);
        if (!target || target.encounterFamilyId !== pokemon.encounterFamilyId) gameError(`${item.name} cannot be used on ${pokemon.name}.`, 409);
        if (pokemon.speciesId === target.id) gameError(`${pokemon.name} already has that form.`, 409);
        pokemon = this.changeForm(run, pokemon, target.id);
      } else if (item.effect === "tm") {
        const slot = Number(options.slot);
        if (!learnableMoveIds(pokemon.speciesId).includes(item.moveId)) gameError(`${pokemon.name} cannot learn ${item.move}.`, 409);
        if (pokemon.moves.some((move) => toID(move) === item.moveId)) gameError(`${pokemon.name} already knows ${item.move}.`, 409);
        if (!Number.isInteger(slot) || slot < 0 || slot >= pokemon.moves.length) gameError("Choose a move to replace.");
        pokemon.moves[slot] = item.move;
      }
      run.inventory[item.id] -= used;
      if (run.inventory[item.id] <= 0) delete run.inventory[item.id];
      return this.publicState(run);
    });
  }

  async quoteTrainingBuild(userId, pokemonId, proposed) {
    return this.mutate(userId, (run) => {
      const pokemon = run.roster.find((candidate) => candidate.id === pokemonId);
      if (!pokemon) gameError("Pokémon not found.", 404);
      return buildTrainingQuote(pokemon, proposed);
    });
  }

  async applyTrainingBuild(userId, pokemonId, proposed, expectedCost, idempotencyKey) {
    return this.mutate(userId, (run) => {
      if (!idempotencyKey || typeof idempotencyKey !== "string" || idempotencyKey.length > 100) gameError("A valid training transaction key is required.");
      run.trainingTransactions ||= [];
      if (run.trainingTransactions.includes(idempotencyKey)) return { state: this.publicState(run), applied: false };
      const pokemon = run.roster.find((candidate) => candidate.id === pokemonId);
      if (!pokemon) gameError("Pokémon not found.", 404);
      const quote = buildTrainingQuote(pokemon, proposed);
      if (Number(expectedCost) !== quote.total) gameError("The training price changed. Review the updated total and try again.", 409);
      if (!quote.changed) gameError("Make at least one training change.", 409);
      if (run.money < quote.total) gameError("You do not have enough coins.", 409);
      run.money -= quote.total;
      const previousId = pokemon.id;
      const species = pokemonById.get(quote.build.speciesId);
      Object.assign(pokemon, quote.build, {
        id: species.id,
        name: species.name,
        spriteId: species.spriteId,
        types: [...species.types],
        encounterFamilyId: species.encounterFamilyId,
      });
      run.teamIds = run.teamIds.map((id) => id === previousId ? pokemon.id : id);
      run.trainingTransactions.push(idempotencyKey);
      if (run.trainingTransactions.length > 100) run.trainingTransactions.splice(0, run.trainingTransactions.length - 100);
      return { state: this.publicState(run), quote, applied: true };
    });
  }

  changeForm(run, pokemon, speciesId) {
    const species = pokemonById.get(speciesId);
    const previousId = pokemon.id;
    Object.assign(pokemon, {
      id: species.id,
      speciesId: species.id,
      name: species.name,
      spriteId: species.spriteId,
      types: [...species.types],
      encounterFamilyId: species.encounterFamilyId,
      moves: defaultMoves(species.id),
    });
    run.teamIds = run.teamIds.map((id) => id === previousId ? pokemon.id : id);
    return pokemon;
  }

  async battleTeam(userId, partyIds, leadId) {
    return this.mutate(userId, (run) => {
      if (!Array.isArray(partyIds) || partyIds.length < 1 || partyIds.length > 6 || new Set(partyIds).size !== partyIds.length) gameError("Choose between one and six different Pokémon.");
      if (partyIds.some((id) => !run.teamIds.includes(id))) gameError("The battle party must use your current team.");
      if (!partyIds.includes(leadId)) gameError("The selected lead must be in the party.");
      const ordered = [leadId, ...partyIds.filter((id) => id !== leadId)];
      return ordered.map((id) => {
        const pokemon = run.roster.find((candidate) => candidate.id === id);
        return {
          name: pokemon.name,
          species: pokemonById.get(pokemon.speciesId).showdownName,
          ability: pokemon.ability,
          item: pokemon.heldItemId ? itemById.get(pokemon.heldItemId)?.name || "" : "",
          nature: pokemon.nature,
          gender: pokemon.gender,
          shiny: pokemon.shiny,
          level: pokemon.level,
          ivs: { ...pokemon.ivs },
          evs: { ...pokemon.evs },
          moves: [...pokemon.moves],
        };
      });
    });
  }
}

export function publicContent() {
  return {
    pokemon: pokemonCatalog,
    items: itemCatalog,
    natures: natureNames,
    startingMoney,
  };
}
