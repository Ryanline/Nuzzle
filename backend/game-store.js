import crypto from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import {
  encounterPokemon,
  itemById,
  itemCatalog,
  natureNames,
  pokemonById,
  pokemonCatalog,
  starterPokemon,
} from "./content.js";

const require = createRequire(import.meta.url);
const { Dex, toID } = require("pokemon-showdown");
const stats = ["hp", "atk", "def", "spa", "spd", "spe"];
const statLabels = { hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" };
const startingMoney = 2500;
const moveCache = new Map();

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
  if (moveCache.has(speciesId)) return [...moveCache.get(speciesId)];
  if (speciesId === "ditto") return ["Transform"];
  if (speciesId === "unown") return ["Hidden Power"];
  let pool;
  try {
    pool = [...Dex.species.getMovePool(speciesId, true)].map((id) => Dex.moves.get(id));
  } catch {
    pool = [];
  }
  const excluded = new Set(["explosion", "selfdestruct", "finalgambit", "memento", "healingwish", "lunardance"]);
  const damaging = pool.filter((move) => move.exists && move.basePower > 0 && !move.isMax && !move.isZ && !excluded.has(move.id));
  const species = Dex.species.get(speciesId);
  const score = (move) => (species.types.includes(move.type) ? 500 : 0) + move.basePower * (move.accuracy === true ? 1 : Number(move.accuracy || 70) / 100) + (move.priority || 0) * 15;
  damaging.sort((left, right) => score(right) - score(left) || left.name.localeCompare(right.name));
  const selected = [];
  const usedTypes = new Set();
  for (const move of damaging) {
    if (selected.length >= 3) break;
    if (usedTypes.has(move.type) && damaging.some((candidate) => !usedTypes.has(candidate.type))) continue;
    selected.push(move.name);
    usedTypes.add(move.type);
  }
  const preferredStatus = [
    "recover", "roost", "synthesis", "moonlight", "morningsun", "shoreup", "slackoff", "strengthsap", "wish",
    "quiverdance", "shellsmash", "dragondance", "nastyplot", "swordsdance", "calmmind", "bulkup",
    "spore", "sleeppowder", "willowisp", "thunderwave", "toxic", "leechseed", "stealthrock", "protect", "substitute",
  ];
  for (const id of preferredStatus) {
    if (selected.length >= 4) break;
    const move = pool.find((candidate) => candidate.id === id);
    if (move) selected.push(move.name);
  }
  for (const move of damaging) {
    if (selected.length >= 4) break;
    if (!selected.includes(move.name)) selected.push(move.name);
  }
  while (selected.length < 4) selected.push(selected.at(-1) || "Tackle");
  moveCache.set(speciesId, selected.slice(0, 4));
  return selected.slice(0, 4);
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

function dateInZone(now, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function encounterCount(date) {
  return new Date(`${date}T12:00:00Z`).getUTCDay() === 0 ? 4 : 3;
}

function ensureDaily(run, date) {
  if (run.daily?.date === date) return;
  const reserved = new Set(run.roster.map((pokemon) => pokemon.encounterFamilyId));
  const total = encounterCount(date);
  const opening = run.roster.length === 0 && !run.openingBatchClaimed;
  const encounters = [];
  for (let slot = 0; slot < total; slot++) {
    const isOpening = opening && slot === 0;
    encounters.push({
      kind: isOpening ? "opening" : "single",
      claimed: false,
      pokemon: generateBatch(run, isOpening ? 12 : 1, isOpening && run.starterGuarantee, reserved),
    });
  }
  run.daily = { date, encounters };
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
    this.data = { version: 1, runs: {} };
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
      const date = dateInZone(this.now(), this.timeZone);
      const month = date.slice(0, 7);
      let run = this.data.runs[userId] ||= newRun(userId, month);
      if (!run.month) run.month = month;
      if (run.month !== month) run = this.data.runs[userId] = newRun(userId, month);
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
        run.openingBatchClaimed = true;
        run.starterGuarantee = false;
      }
      if (!run.teamIds.length) run.teamIds = run.roster.slice(0, 6).map((pokemon) => pokemon.id);
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

  async useTrainingItem(userId, pokemonId, itemId, options = {}) {
    return this.mutate(userId, (run) => {
      let pokemon = run.roster.find((candidate) => candidate.id === pokemonId);
      const item = itemById.get(itemId);
      if (!pokemon) gameError("Pokémon not found.", 404);
      if (!item || item.group !== "Training Items") gameError("That is not a training item.");
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
      }
      run.inventory[item.id] -= used;
      if (run.inventory[item.id] <= 0) delete run.inventory[item.id];
      return this.publicState(run);
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
    pokemon: pokemonCatalog.map(({ baseStats, ordinaryAbilities, hiddenAbility, ...pokemon }) => pokemon),
    items: itemCatalog,
    natures: natureNames,
    startingMoney,
  };
}
