import crypto from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { buildBrockTeam } from "./teams.js";
import { datesAfter, gameDate, gameNumber, nextGameDate, nextRolloverAt } from "./game-clock.js";
import { trainerSpriteIds } from "./trainer-sprite-ids.js";

const require = createRequire(import.meta.url);
const { Dex, Teams, toID } = require("pokemon-showdown");

const spriteNames = new Map([
  ["ltsurge", "Lt. Surge"],
]);
function trainerSpriteName(id) {
  if (spriteNames.has(id)) return spriteNames.get(id);
  return id.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
export const trainerSprites = Object.freeze(trainerSpriteIds.map((id) => Object.freeze({ id, name: trainerSpriteName(id) })));
const spriteIds = new Set(trainerSprites.map((sprite) => sprite.id));

function trainerError(message, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode });
}

function pokemonSummary(set) {
  const species = Dex.species.get(set.species || set.name);
  const level = set.level || 100;
  const speedStat = (iv, ev, natureNumerator) => {
    const core = Math.floor(((2 * species.baseStats.spe + iv + Math.floor(ev / 4)) * level) / 100) + 5;
    return Math.floor(core * natureNumerator / 10);
  };
  return {
    id: species.id || toID(set.species || set.name),
    name: species.name || set.species || set.name,
    spriteId: species.spriteid || species.id || toID(set.species || set.name),
    shiny: Boolean(set.shiny),
    types: [...species.types],
    possibleAbilities: [...new Set(Object.values(species.abilities).filter(Boolean))],
    speedRange: {
      min: speedStat(0, 0, 9),
      max: speedStat(31, 252, 11),
    },
  };
}

function validateTeam(teamText) {
  const text = String(teamText || "").trim();
  if (!text) trainerError("Paste a Showdown team.");
  let team;
  try {
    team = Teams.import(text);
  } catch {
    trainerError("That Showdown team could not be parsed.");
  }
  if (!Array.isArray(team) || team.length < 1 || team.length > 6) trainerError("A trainer team must contain between one and six Pokémon.");
  for (const set of team) {
    const species = Dex.species.get(set.species || set.name);
    if (!species.exists) trainerError(`Unknown Pokémon: ${set.species || set.name || "unnamed set"}.`);
    if (!Array.isArray(set.moves) || set.moves.length < 1 || set.moves.length > 4) trainerError(`${species.name} needs between one and four moves.`);
    for (const moveName of set.moves) if (!Dex.moves.get(moveName).exists) trainerError(`${species.name} has an unknown move: ${moveName}.`);
    if (set.ability && !Dex.abilities.get(set.ability).exists) trainerError(`${species.name} has an unknown ability: ${set.ability}.`);
    if (set.item && !Dex.items.get(set.item).exists) trainerError(`${species.name} has an unknown item: ${set.item}.`);
    if (set.nature && !Dex.natures.get(set.nature).exists) trainerError(`${species.name} has an unknown nature: ${set.nature}.`);
    set.name ||= species.name;
    set.species = species.name;
    set.level ||= 100;
  }
  return { text, team };
}

function defaultTrainer() {
  return {
    id: "brock-default",
    name: "Brock",
    spriteId: "brock",
    teamText: Teams.export(buildBrockTeam()),
    team: buildBrockTeam(),
    fallback: true,
  };
}

function snapshot(trainer, date) {
  return {
    date,
    number: gameNumber(date),
    publishedAt: new Date().toISOString(),
    trainer: structuredClone(trainer),
  };
}

function publicTrainer(trainer, includeTeamText = false) {
  return {
    id: trainer.id,
    name: trainer.name,
    spriteId: trainer.spriteId,
    pokemon: trainer.team.map(pokemonSummary),
    ...(includeTeamText ? { teamText: trainer.teamText } : {}),
  };
}

export class TrainerStore {
  constructor(filename, { timeZone = process.env.NUZZLE_TIME_ZONE || "America/New_York", now = () => new Date() } = {}) {
    this.filename = filename;
    this.timeZone = timeZone;
    this.now = now;
    this.data = { version: 1, queue: [], daily: {} };
    this.pending = Promise.resolve();
    this.writeSequence = 0;
  }

  async initialize() {
    await mkdir(path.dirname(this.filename), { recursive: true });
    try {
      const stored = JSON.parse(await readFile(this.filename, "utf8"));
      this.data = {
        version: 1,
        queue: Array.isArray(stored.queue) ? stored.queue : [],
        daily: stored.daily && typeof stored.daily === "object" ? stored.daily : {},
      };
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

  async mutate(operation) {
    let result;
    this.pending = this.pending.catch(() => {}).then(async () => {
      result = await operation();
      await this.save();
    });
    await this.pending;
    return result;
  }

  ensureThrough(date) {
    const knownDates = Object.keys(this.data.daily).sort();
    if (!knownDates.length) {
      this.data.daily[date] = snapshot(defaultTrainer(), date);
      return;
    }
    const latest = knownDates.at(-1);
    for (const missingDate of datesAfter(latest, date)) {
      const trainer = this.data.queue.shift() || defaultTrainer();
      this.data.daily[missingDate] = snapshot(trainer, missingDate);
    }
    if (!this.data.daily[date]) this.data.daily[date] = snapshot(this.data.queue.shift() || defaultTrainer(), date);
    // Challenge numbering can be rebased independently of the immutable daily
    // trainer selection. Refreshing this field preserves today's opponent and
    // every player's run while allowing a new numbered season to begin.
    this.data.daily[date].number = gameNumber(date);
  }

  async current() {
    return this.mutate(() => {
      const now = this.now();
      const date = gameDate(now, this.timeZone);
      this.ensureThrough(date);
      const challenge = this.data.daily[date];
      return {
        date,
        number: challenge.number,
        nextRolloverAt: nextRolloverAt(now, this.timeZone),
        trainer: publicTrainer(challenge.trainer),
        opponentTeam: structuredClone(challenge.trainer.team),
      };
    });
  }

  async adminState() {
    return this.mutate(() => {
      const now = this.now();
      const date = gameDate(now, this.timeZone);
      this.ensureThrough(date);
      return {
        current: {
          date,
          number: this.data.daily[date].number,
          trainer: publicTrainer(this.data.daily[date].trainer),
        },
        queue: this.data.queue.map((trainer, index) => ({
          ...publicTrainer(trainer, true),
          scheduledDate: Array.from({ length: index + 1 }).reduce((value) => nextGameDate(value), date),
        })),
        sprites: trainerSprites,
      };
    });
  }

  async add({ name, spriteId, teamText }) {
    return this.mutate(() => {
      const trainerName = String(name || "").trim();
      if (trainerName.length < 1 || trainerName.length > 40) trainerError("Trainer name must be between 1 and 40 characters.");
      if (!spriteIds.has(spriteId)) trainerError("Choose a valid trainer sprite.");
      const parsed = validateTeam(teamText);
      this.data.queue.push({
        id: crypto.randomUUID(),
        name: trainerName,
        spriteId,
        teamText: parsed.text,
        team: parsed.team,
        createdAt: new Date().toISOString(),
      });
      return true;
    });
  }

  async reorder(ids) {
    return this.mutate(() => {
      if (!Array.isArray(ids) || ids.length !== this.data.queue.length || new Set(ids).size !== ids.length) trainerError("The trainer order is invalid.");
      const trainers = new Map(this.data.queue.map((trainer) => [trainer.id, trainer]));
      if (ids.some((id) => !trainers.has(id))) trainerError("The trainer order is out of date.", 409);
      this.data.queue = ids.map((id) => trainers.get(id));
      return true;
    });
  }

  async remove(id) {
    return this.mutate(() => {
      const index = this.data.queue.findIndex((trainer) => trainer.id === id);
      if (index < 0) trainerError("Queued trainer not found.", 404);
      this.data.queue.splice(index, 1);
      return true;
    });
  }
}

export { validateTeam };
