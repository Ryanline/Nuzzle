import crypto from "node:crypto";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { gunzip, gzip } from "node:zlib";
import { promisify } from "node:util";
import {
  abilityCatalog,
  encounterPokemon,
  itemById,
  itemCatalog,
  learnableMoveIds,
  pokemonById,
  pokemonCatalog,
  starterPokemon,
} from "./content.js";
import { generateEncounterMoves } from "./movesets.js";
import { gameDate, nextGameDate } from "./game-clock.js";

const require = createRequire(import.meta.url);
const { Dex, toID } = require("pokemon-showdown");
const stats = ["hp", "atk", "def", "spa", "spd", "spe"];
const statLabels = { hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" };
const startingMoney = 50000;
const victoryReward = 15000;
const directTrainingVersion = 1;
const simplifiedPlayerStatsVersion = 1;
const sharedDailyBoxVersion = 1;
const implicitPlayerIvs = Object.freeze(Object.fromEntries(stats.map((stat) => [stat, 31])));
const implicitPlayerEvs = Object.freeze(Object.fromEntries(stats.map((stat) => [stat, 0])));
const implicitPlayerNature = "Serious";
const retiredPlayerStatEffects = new Set(["ev", "iv", "nature"]);
const runArchiveRetentionDays = 30;
const sharedDailyEncounterCount = 12;
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const sharedDailyBoxStartDate = process.env.NUZZLE_SHARED_DAILY_BOX_START_DATE || "2026-11-22";
const starterRotationStartDate = sharedDailyBoxStartDate;
const starterTrios = Object.freeze([
  Object.freeze(["venusaur", "charizard", "blastoise"]),
  Object.freeze(["meganium", "typhlosion", "feraligatr"]),
  Object.freeze(["sceptile", "blaziken", "swampert"]),
  Object.freeze(["torterra", "infernape", "empoleon"]),
  Object.freeze(["chesnaught", "delphox", "greninja"]),
  Object.freeze(["decidueye", "incineroar", "primarina"]),
  Object.freeze(["rillaboom", "cinderace", "inteleon"]),
  Object.freeze(["decidueyehisui", "typhlosionhisui", "samurotthisui"]),
  Object.freeze(["meowscarada", "skeledirge", "quaquaval"]),
]);

function shiftGameDate(date, days) {
  let shifted = date;
  for (let count = 0; count < Math.abs(days); count++) {
    if (days > 0) shifted = nextGameDate(shifted);
    else {
      const value = new Date(`${shifted}T12:00:00Z`);
      value.setUTCDate(value.getUTCDate() - 1);
      shifted = value.toISOString().slice(0, 10);
    }
  }
  return shifted;
}

function dateDistance(fromDate, toDate) {
  return Math.round((Date.parse(`${toDate}T12:00:00Z`) - Date.parse(`${fromDate}T12:00:00Z`)) / 86_400_000);
}

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
  const ability = randomChoice(speciesData.ordinaryAbilities);
  return {
    id: speciesData.id,
    encounterFamilyId: speciesData.encounterFamilyId,
    speciesId: speciesData.id,
    name: speciesData.name,
    spriteId: speciesData.spriteId,
    types: [...speciesData.types],
    level: 100,
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

function generateBatch(count, pool, reservedFamilies) {
  const generated = [];
  for (let index = 0; index < count; index++) {
    const species = weightedPokemon(pool, reservedFamilies);
    generated.push(createPokemon(species));
    reservedFamilies.add(species.encounterFamilyId);
  }
  return generated;
}

function generateSharedDailyEncounters(date) {
  const rotationOffset = dateDistance(starterRotationStartDate, date);
  const starterIds = starterTrios[((rotationOffset % starterTrios.length) + starterTrios.length) % starterTrios.length];
  const dailyStarterPokemon = starterIds.map((speciesId) => createPokemon(pokemonById.get(speciesId)));
  const reservedFamilies = new Set(dailyStarterPokemon.map((pokemon) => pokemon.encounterFamilyId));
  const encounters = [{
    kind: "starter",
    choiceVersion: 1,
    pokemon: dailyStarterPokemon,
  }];
  while (encounters.length < sharedDailyEncounterCount) {
    encounters.push({
      kind: "daily",
      choiceVersion: 1,
      pokemon: generateBatch(3, encounterPokemon, reservedFamilies),
    });
  }
  return { date, createdAt: new Date().toISOString(), encounters };
}

function encounterCount(date) {
  return new Date(`${date}T12:00:00Z`).getUTCDay() === 0 ? 4 : 3;
}

function ensureLegacyDaily(run, date) {
  if (run.daily?.date === date) return;
  if (run.daily?.encounters.some((encounter) => encounter.kind === "opening" && !encounter.claimed)) return;
  const reserved = new Set(run.roster.map((pokemon) => pokemon.encounterFamilyId));
  const opening = run.roster.length === 0 && !run.openingBatchClaimed;
  const total = opening ? 12 : encounterCount(date);
  const encounters = [];
  for (let slot = 0; slot < total; slot++) {
    const starterChoice = opening && slot === 0 && run.starterGuarantee;
    encounters.push({
      kind: opening ? "opening" : "single",
      choiceVersion: 1,
      revealed: false,
      claimed: false,
      selectedIndex: null,
      pokemon: generateBatch(3, starterChoice ? starterPokemon : encounterPokemon, reserved),
    });
  }
  run.daily = { date, encounters };
  if (opening) run.starterGuarantee = false;
}

function ensureSharedDailyEncounters(data, date) {
  data.sharedDailyEncounters ||= {};
  data.sharedDailyEncounters[date] ||= generateSharedDailyEncounters(date);
  const oldestRetainedDate = shiftGameDate(date, -runArchiveRetentionDays);
  for (const retainedDate of Object.keys(data.sharedDailyEncounters)) {
    if (retainedDate < oldestRetainedDate) delete data.sharedDailyEncounters[retainedDate];
  }
  return data.sharedDailyEncounters[date];
}

function dailyEncounterState(data, date) {
  const shared = ensureSharedDailyEncounters(data, date);
  return {
    date,
    encounters: shared.encounters.map((encounter) => ({
      ...structuredClone(encounter),
      revealed: false,
      claimed: false,
      selectedIndex: null,
    })),
  };
}

function migrateOpeningEncounters(run) {
  if (!run.daily?.encounters) return;
  run.daily.encounters = run.daily.encounters.flatMap((encounter) => !encounter.choiceVersion && encounter.kind === "opening" && encounter.pokemon.length > 1
    ? encounter.pokemon.map((pokemon) => ({ kind: "opening", claimed: encounter.claimed, pokemon: [pokemon] }))
    : [encounter]);
  for (const encounter of run.daily.encounters) {
    if (encounter.revealed === undefined) encounter.revealed = Boolean(encounter.claimed);
    if (encounter.selectedIndex === undefined) encounter.selectedIndex = encounter.claimed ? 0 : null;
  }
}

function calculatedStats(pokemon) {
  const species = pokemonById.get(pokemon.speciesId);
  return Object.fromEntries(stats.map((stat) => {
    const base = species.baseStats[stat];
    const core = Math.floor(((2 * base + implicitPlayerIvs[stat]) * pokemon.level) / 100);
    const value = stat === "hp" ? (base === 1 ? 1 : core + pokemon.level + 10) : core + 5;
    return [stat, value];
  }));
}

function trainingItem(effect, predicate = () => true) {
  return itemCatalog.find((item) => item.effect === effect && predicate(item));
}

function migrateDirectTraining(run) {
  if ((run.directTrainingVersion || 0) >= directTrainingVersion) return false;
  for (const [itemId, quantity] of Object.entries(run.inventory || {})) {
    const item = itemById.get(itemId);
    if (!item || !["Training Items", "TMs"].includes(item.group)) continue;
    run.money += item.price * quantity;
    delete run.inventory[itemId];
  }
  run.directTrainingVersion = directTrainingVersion;
  return true;
}

function stripPlayerStatFields(pokemon) {
  if (!pokemon || typeof pokemon !== "object") return false;
  let changed = false;
  for (const field of ["ivs", "evs", "nature"]) {
    if (!(field in pokemon)) continue;
    delete pokemon[field];
    changed = true;
  }
  return changed;
}

function migrateSimplifiedPlayerStats(run) {
  if ((run.simplifiedPlayerStatsVersion || 0) >= simplifiedPlayerStatsVersion) return false;
  for (const pokemon of run.roster || []) stripPlayerStatFields(pokemon);
  for (const encounter of run.daily?.encounters || []) {
    for (const pokemon of encounter.pokemon || []) stripPlayerStatFields(pokemon);
  }
  const money = Math.max(Number(run.money) || 0, startingMoney);
  run.money = money;
  run.simplifiedPlayerStatsVersion = simplifiedPlayerStatsVersion;
  return true;
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

  const normalized = { speciesId, ability, moves };
  const preview = { ...pokemon, ...normalized, name: species.name, level: pokemon.level };
  const changed = speciesId !== pokemon.speciesId
    || ability !== pokemon.ability
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

function newRun(userId, startDate, resetNotice = null) {
  return {
    id: crypto.randomUUID(),
    userId,
    createdAt: new Date().toISOString(),
    month: startDate?.slice(0, 7) || null,
    startDate,
    money: startingMoney,
    roster: [],
    teamIds: [],
    inventory: {},
    purchasedUnique: [],
    openingBatchClaimed: false,
    starterGuarantee: true,
    daily: null,
    directTrainingVersion,
    simplifiedPlayerStatsVersion,
    sharedDailyBoxVersion,
    trainingTransactions: [],
    resetNotice,
  };
}

function availableItemCount(run, itemId, excludingPokemonId = null) {
  const equipped = run.roster.filter((pokemon) => pokemon.id !== excludingPokemonId && pokemon.heldItemId === itemId).length;
  return (run.inventory[itemId] || 0) - equipped;
}

export class GameStore {
  constructor(filename, {
    timeZone = process.env.NUZZLE_TIME_ZONE || "America/New_York",
    now = () => new Date(),
    supportStore = null,
    usernameForUserId = () => null,
    dailyOutcome = null,
    missedDayWipeStartDate = process.env.NUZZLE_MISSED_DAY_WIPE_START_DATE || "2026-11-09",
  } = {}) {
    this.filename = filename;
    this.archiveDirectory = path.join(path.dirname(filename), "run-archive");
    this.timeZone = timeZone;
    this.now = now;
    this.supportStore = supportStore;
    this.usernameForUserId = usernameForUserId;
    this.dailyOutcome = dailyOutcome;
    this.missedDayWipeStartDate = missedDayWipeStartDate;
    this.data = { version: 3, runs: {}, sharedDailyEncounters: {} };
    this.guestIds = new Set();
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
    this.data.version = 3;
    this.data.runs ||= {};
    this.data.sharedDailyEncounters ||= {};
    let changed = false;
    for (const run of Object.values(this.data.runs || {})) {
      changed = migrateDirectTraining(run) || changed;
      changed = migrateSimplifiedPlayerStats(run) || changed;
    }
    if (changed) await this.save();
    await this.supportStore?.snapshot(gameDate(this.now(), this.timeZone), { game: this.data });
  }

  setDailyOutcomeLookup(dailyOutcome) {
    this.dailyOutcome = dailyOutcome;
  }

  async save() {
    const sequence = ++this.writeSequence;
    const temporary = `${this.filename}.${process.pid}.${sequence}.tmp`;
    await writeFile(temporary, `${JSON.stringify(this.data, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, this.filename);
  }

  async archiveRun(run, reason, resetDate, context = {}) {
    if (!run?.id) return null;
    await mkdir(this.archiveDirectory, { recursive: true });
    const archiveId = crypto.randomUUID();
    const safeUserId = String(run.userId || "unknown").replace(/[^a-z0-9-]/gi, "_");
    const destination = path.join(this.archiveDirectory, `${resetDate}--${safeUserId}--${run.id}--${archiveId}.json.gz`);
    const temporary = `${destination}.${process.pid}.tmp`;
    const archiveUntil = shiftGameDate(resetDate, runArchiveRetentionDays);
    const record = {
      archiveVersion: 1,
      archiveId,
      reason,
      resetDate,
      archiveUntil,
      ...context,
      run: structuredClone(run),
    };
    await writeFile(temporary, await gzipAsync(`${JSON.stringify(record, null, 2)}\n`, { level: 9 }), { mode: 0o600 });
    await rename(temporary, destination);
    await this.supportStore?.record({
      id: `run-archive:${archiveId}`,
      type: "run_archived",
      gameDate: resetDate,
      archiveId,
      reason,
      userId: run.userId,
      username: this.usernameForUserId(run.userId),
      runId: run.id,
      startDate: run.startDate || null,
      pokemon: (run.roster || []).map((pokemon) => ({ id: pokemon.id, name: pokemon.name })),
      money: run.money,
      ...context,
    });
    const oldestRetainedDate = shiftGameDate(resetDate, -runArchiveRetentionDays);
    for (const name of await readdir(this.archiveDirectory)) {
      if (!name.endsWith(".json.gz") || name.slice(0, 10) >= oldestRetainedDate) continue;
      await unlink(path.join(this.archiveDirectory, name)).catch((error) => {
        if (error.code !== "ENOENT") console.error(`Could not remove expired run archive ${name}:`, error);
      });
    }
    return {
      archiveId,
      reason,
      resetDate,
      archiveUntil,
      previousRunId: run.id,
      previousStartDate: run.startDate || null,
      pokemonCount: run.roster?.length || 0,
      ...context,
    };
  }

  async mutate(userId, operation) {
    let result;
    this.pending = this.pending.catch(() => {}).then(async () => {
      const date = gameDate(this.now(), this.timeZone);
      await this.supportStore?.snapshot(date, { game: this.data });
      const guest = this.guestIds.has(userId);
      let run = this.data.runs[userId];
      const sharedDailyBoxesActive = date >= sharedDailyBoxStartDate;
      if (sharedDailyBoxesActive) {
        if (!run || run.startDate !== date || run.sharedDailyBoxVersion !== sharedDailyBoxVersion) {
          run = this.data.runs[userId] = newRun(userId, date);
          if (guest) run.guestDate = date;
        }
      } else {
        if (!run || (guest && run.guestDate !== date)) {
          run = this.data.runs[userId] = newRun(userId, date);
          if (guest) run.guestDate = date;
        }
        migrateOpeningEncounters(run);
        if (!run.startDate) run.startDate = date;
        run.month = run.startDate.slice(0, 7);
      }
      migrateDirectTraining(run);
      migrateSimplifiedPlayerStats(run);
      if (sharedDailyBoxesActive) run.daily ||= dailyEncounterState(this.data, date);
      else ensureLegacyDaily(run, date);
      result = await operation(run, date);
      await this.save();
    });
    await this.pending;
    return result;
  }

  publicState(run) {
    const encounters = run.daily.encounters.map((encounter, slot) => {
      const selected = encounter.pokemon[encounter.selectedIndex ?? 0];
      const visiblePokemon = encounter.claimed
        ? selected ? [pokemonView(selected)] : []
        : encounter.revealed ? encounter.pokemon.map(pokemonView) : null;
      return {
        slot,
        kind: encounter.kind,
        count: encounter.claimed ? visiblePokemon.length : encounter.pokemon.length,
        revealed: Boolean(encounter.revealed),
        claimed: encounter.claimed,
        pokemon: visiblePokemon,
      };
    });
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
      sharedDailyBoxesActive: run.daily.date >= sharedDailyBoxStartDate,
      runLifecycle: null,
    };
  }

  async get(userId) {
    return this.mutate(userId, (run) => this.publicState(run));
  }

  identifyGuest(userId) {
    this.guestIds.add(userId);
  }

  async promoteGuest(userId) {
    this.guestIds.delete(userId);
    return this.mutate(userId, (run) => {
      delete run.guestDate;
      return this.publicState(run);
    });
  }

  async revealEncounter(userId, slot) {
    return this.mutate(userId, (run) => {
      const encounter = run.daily.encounters[slot];
      if (!encounter) gameError("Encounter not found.", 404);
      if (encounter.claimed || encounter.revealed) return this.publicState(run);
      const pendingSlot = run.daily.encounters.findIndex((candidate) => candidate.revealed && !candidate.claimed);
      if (pendingSlot !== -1 && pendingSlot !== slot) gameError("Choose a Pokémon from the revealed encounter first.", 409);
      encounter.revealed = true;
      return this.publicState(run);
    });
  }

  async claimEncounter(userId, slot, candidateIndex = null) {
    return this.mutate(userId, (run) => {
      const encounter = run.daily.encounters[slot];
      if (!encounter) gameError("Encounter not found.", 404);
      if (encounter.claimed) return this.publicState(run);
      const legacySelection = candidateIndex === null;
      if (legacySelection) encounter.revealed = true;
      if (!encounter.revealed) gameError("Reveal this encounter before choosing a Pokémon.", 409);
      const selectedIndex = legacySelection ? 0 : Number(candidateIndex);
      if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= encounter.pokemon.length) gameError("Choose one of the revealed Pokémon.");
      const pokemon = encounter.pokemon[selectedIndex];
      if (run.roster.some((owned) => owned.encounterFamilyId === pokemon.encounterFamilyId)) gameError("That encounter conflicts with an owned Pokémon.", 409);
      encounter.claimed = true;
      encounter.selectedIndex = selectedIndex;
      run.roster.push(pokemon);
      if (pokemon.heldItemId === "leftovers") run.inventory.leftovers = (run.inventory.leftovers || 0) + 1;
      if (encounter.kind === "opening") {
        run.openingBatchClaimed = run.daily.encounters.every((candidate) => candidate.claimed);
      }
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

  async equip(userId, pokemonId, itemId, sourcePokemonId = null) {
    return this.mutate(userId, (run) => {
      const pokemon = run.roster.find((candidate) => candidate.id === pokemonId);
      const item = itemById.get(itemId);
      if (!pokemon) gameError("Pokémon not found.", 404);
      if (!item || item.group !== "Held Items") gameError("That is not a held item.");
      if (pokemon.heldItemId === itemId) gameError(`${pokemon.name} is already holding ${item.name}.`, 409);
      if (sourcePokemonId) {
        const source = run.roster.find((candidate) => candidate.id === sourcePokemonId);
        if (!source || source.id === pokemon.id || source.heldItemId !== itemId) gameError(`The selected Pokémon is no longer holding ${item.name}.`, 409);
        source.heldItemId = null;
      } else if (availableItemCount(run, itemId, pokemon.id) < 1) {
        gameError(`No unequipped ${item.name} is available.`, 409);
      }
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
    return this.mutate(userId, (run, date) => {
      run.settledBattleIds ||= [];
      if (run.settledBattleIds.includes(battleId)) return this.publicState(run);
      for (const acquisition of acquisitions) {
        const pokemon = run.roster.find((candidate) => candidate.id === acquisition.pokemonId);
        const item = itemById.get(acquisition.itemId);
        if (!pokemon || pokemon.heldItemId || !item || item.group !== "Held Items") continue;
        run.inventory[item.id] = (run.inventory[item.id] || 0) + 1;
        pokemon.heldItemId = item.id;
      }
      if (date < sharedDailyBoxStartDate) {
        const fainted = new Set(faintedPokemonIds);
        run.roster = run.roster.filter((pokemon) => !fainted.has(pokemon.id));
        run.teamIds = run.teamIds.filter((id) => !fainted.has(id));
        if (won) run.money += victoryReward;
      }
      run.settledBattleIds.push(battleId);
      return this.publicState(run);
    });
  }

  async resetAfterWipe(userId, battleId) {
    return this.mutate(userId, async (run, date) => {
      if (run.resetFromBattleId === battleId) return this.publicState(run);
      if (date < sharedDailyBoxStartDate) {
        await this.archiveRun(run, "loss", date);
        const replacement = newRun(userId, nextGameDate(date));
        if (run.guestDate) replacement.guestDate = run.guestDate;
        replacement.resetFromBattleId = battleId;
        replacement.daily = { date: run.daily.date, encounters: [] };
        this.data.runs[userId] = replacement;
        return this.publicState(replacement);
      }
      run.resetFromBattleId = battleId;
      return this.publicState(run);
    });
  }

  async restoreArchivedLoss(userId, date, rollbackKey) {
    return this.mutate(userId, async (run) => {
      this.data.oneTimeRollbacks ||= {};
      if (this.data.oneTimeRollbacks[rollbackKey]) {
        return { applied: false, state: this.publicState(run) };
      }
      let archivedRun = null;
      for (const name of await readdir(this.archiveDirectory).catch((error) => {
        if (error.code === "ENOENT") return [];
        throw error;
      })) {
        if (!name.endsWith(".json.gz")) continue;
        try {
          const archive = JSON.parse((await gunzipAsync(await readFile(path.join(this.archiveDirectory, name)))).toString("utf8"));
          if (archive.reason !== "loss" || archive.resetDate !== date || archive.run?.userId !== userId) continue;
          if (!archivedRun || String(archive.createdAt || archive.run?.createdAt || "").localeCompare(String(archivedRun.createdAt || archivedRun.run?.createdAt || "")) > 0) {
            archivedRun = archive;
          }
        } catch (error) {
          console.error(`Could not inspect archived run ${name} for rollback:`, error);
        }
      }
      if (!archivedRun?.run) throw new Error(`No archived loss was found for ${userId} on ${date}.`);
      const restored = structuredClone(archivedRun.run);
      this.data.runs[userId] = restored;
      this.data.oneTimeRollbacks[rollbackKey] = {
        userId,
        date,
        restoredRunId: restored.id,
        archiveId: archivedRun.archiveId || null,
        appliedAt: new Date().toISOString(),
      };
      return { applied: true, state: this.publicState(restored) };
    });
  }

  async resetForTesting(userId) {
    return this.mutate(userId, async (run, date) => {
      if (date < sharedDailyBoxStartDate) await this.archiveRun(run, "developer", date);
      const replacement = newRun(userId, date);
      if (date >= sharedDailyBoxStartDate) replacement.daily = dailyEncounterState(this.data, date);
      else ensureLegacyDaily(replacement, date);
      if (run.guestDate) replacement.guestDate = date;
      this.data.runs[userId] = replacement;
      return this.publicState(replacement);
    });
  }

  async expireForTesting(userId) {
    return this.mutate(userId, (run, date) => {
      const replacement = newRun(userId, date);
      if (date >= sharedDailyBoxStartDate) replacement.daily = dailyEncounterState(this.data, date);
      else ensureLegacyDaily(replacement, date);
      this.data.runs[userId] = replacement;
      return this.publicState(replacement);
    });
  }

  async acknowledgeRunReset(userId) {
    return this.mutate(userId, (run) => {
      run.resetNotice = null;
      return this.publicState(run);
    });
  }

  async useTrainingItem(userId, pokemonId, itemId, options = {}) {
    return this.mutate(userId, (run) => {
      let pokemon = run.roster.find((candidate) => candidate.id === pokemonId);
      const item = itemById.get(itemId);
      if (!pokemon) gameError("Pokémon not found.", 404);
      if (!item || !["Training Items", "TMs"].includes(item.group)) gameError("That item cannot be used for training.");
      if (retiredPlayerStatEffects.has(item.effect)) gameError("IVs, EVs, and natures are no longer part of player Pokémon.", 409);
      if ((run.inventory[item.id] || 0) < 1) gameError(`You do not own ${item.name}.`, 409);
      let used = 1;
      if (item.effect === "ability-capsule") {
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
          nature: implicitPlayerNature,
          gender: pokemon.gender,
          shiny: pokemon.shiny,
          level: pokemon.level,
          ivs: { ...implicitPlayerIvs },
          evs: { ...implicitPlayerEvs },
          moves: [...pokemon.moves],
        };
      });
    });
  }
}

export function publicContent() {
  return {
    pokemon: pokemonCatalog,
    abilities: abilityCatalog,
    items: itemCatalog.filter((item) => !retiredPlayerStatEffects.has(item.effect)),
    startingMoney,
  };
}
