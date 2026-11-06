import crypto from "node:crypto";
import { createRequire } from "node:module";
import { buildBrockTeam, buildPlayerTeam } from "./teams.js";
import { defaultLaunchDate } from "./game-clock.js";

const require = createRequire(import.meta.url);
const { BattleStream, Dex, Teams, getPlayerStreams, toID } = require("pokemon-showdown");

const FORMAT = "gen9customgame";
const screenConditions = ["reflect", "lightscreen", "auroraveil"];
const hazardConditions = ["spikes", "toxicspikes", "stealthrock", "stickyweb"];
const situationalScreenMoves = new Set(["brickbreak", "psychicfangs", "ragingbull", "defog", "courtchange"]);
const situationalBoostMoves = new Set(["haze", "clearsmog", "topsyturvy", "spectralthief"]);
const situationalHazardMoves = new Set(["rapidspin", "mortalspin", "defog", "tidyup", "courtchange"]);
const recoveryMoveIds = new Set([
  "healorder", "junglehealing", "lifedew", "lunarblessing", "milkdrink", "moonlight", "morningsun",
  "recover", "rest", "roost", "shoreup", "slackoff", "softboiled", "strengthsap", "synthesis", "wish",
]);
const protectMoveIds = new Set(["banefulbunker", "burningbulwark", "detect", "kingsshield", "obstruct", "protect", "silktrap", "spikyshield"]);
const pivotMoveIds = new Set(["chillyreception", "flipturn", "partingshot", "teleport", "uturn", "voltswitch"]);
const cleanseMoveIds = new Set(["aromatherapy", "healbell", "junglehealing", "lunarblessing", "refresh"]);
const utilityCooldownMoveIds = new Set(["counter", "destinybond", "disable", "encore", "mirrorcoat", "taunt"]);
const crashMoveIds = new Set(["highjumpkick", "jumpkick"]);
const speedOnlySetupMoveIds = new Set(["agility", "autotomize", "rockpolish"]);

function seed() {
  return Array.from({ length: 4 }, () => crypto.randomInt(0x10000));
}

function isFainted(condition = "") {
  return condition.endsWith(" fnt");
}

function choiceError(message, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode });
}

function randomEntry(values) {
  return values[crypto.randomInt(values.length)];
}

function isRecoveryMove(move) {
  return recoveryMoveIds.has(move.id);
}

function moveAccuracy(move) {
  return move.accuracy === true ? 100 : Number(move.accuracy || 0);
}

function koChance(damage, hp) {
  if (!damage || damage.max < hp) return 0;
  if (damage.min >= hp) return 1;
  return (damage.max - hp + 1) / Math.max(1, damage.max - damage.min + 1);
}

function offensiveSetupMove(move, source) {
  if (move.id === "substitute") return true;
  const boosts = move.self?.boosts || (move.target === "self" ? move.boosts : null);
  if (!boosts) return false;
  const contrary = source.hasAbility("contrary");
  return Object.entries(boosts).some(([stat, amount]) => ["atk", "spa", "spe"].includes(stat) && (contrary ? amount < 0 : amount > 0));
}

function setupMove(move, source) {
  if (move.id === "substitute") return true;
  const boosts = move.self?.boosts || (move.target === "self" ? move.boosts : null);
  if (!boosts) return false;
  const contrary = source.hasAbility("contrary");
  return Object.values(boosts).some((amount) => (contrary ? amount < 0 : amount > 0));
}

function fatalSelfDamage(candidate, source) {
  if (candidate.move.selfdestruct) return true;
  const recoil = candidate.move.recoil;
  if (recoil && candidate.damage) return Math.floor(candidate.damage.max * recoil[0] / recoil[1]) >= source.hp;
  return Boolean(candidate.damage?.max) && source.hasItem("lifeorb") && source.hp <= Math.max(1, Math.floor(source.maxhp / 10));
}

function tiedMoveChoice(candidates, source, choose = randomEntry) {
  if (!candidates.length) return null;
  let pool = candidates;
  const safe = pool.filter((candidate) => !fatalSelfDamage(candidate, source));
  if (safe.length) pool = safe;
  const boosting = pool.filter(({ move }) => offensiveSetupMove(move, source));
  if (boosting.length) pool = boosting;
  const accuracy = Math.max(...pool.map(({ move }) => moveAccuracy(move)));
  pool = pool.filter(({ move }) => moveAccuracy(move) === accuracy);
  return choose(pool);
}

export function recoveryMoveChoice(candidates, source, randomInt = crypto.randomInt) {
  if (!candidates.length || source.hp * 2 > source.maxhp || randomInt(2) !== 0) return null;
  return candidates[randomInt(candidates.length)];
}

export function shuffledTeamOrder(length, randomInt = crypto.randomInt) {
  const slots = Array.from({ length }, (_, index) => index + 1);
  for (let index = slots.length - 1; index > 0; index--) {
    const swapIndex = randomInt(index + 1);
    [slots[index], slots[swapIndex]] = [slots[swapIndex], slots[index]];
  }
  return slots;
}

export function trainerReplacementChoice(pokemon, choose = randomEntry) {
  const slots = pokemon
    .map((candidate, index) => ({ pokemon: candidate, slot: index + 1 }))
    .filter(({ pokemon: candidate }) => !candidate.active && !isFainted(candidate.condition));
  return slots.length ? `switch ${choose(slots).slot}` : "pass";
}

export function leaderboardStanding(entries) {
  const current = entries.find((entry) => entry.isCurrentPlayer);
  if (!current?.won) return null;
  const total = entries.length;
  const tied = entries.filter((entry) => entry.rank === current.rank).length > 1;
  const playersBehind = entries.filter((entry) => entry.rank > current.rank).length;
  return {
    rank: current.rank,
    total,
    tied,
    firstFinisher: total === 1,
    betterThanPercent: total ? Math.round(playersBehind / total * 100) : 0,
  };
}

function savedTeamOrder(order, length) {
  const fallback = Array.from({ length }, (_, index) => index + 1);
  if (!Array.isArray(order) || order.length !== length) return fallback;
  const normalized = order.map(Number);
  return [...normalized].sort((left, right) => left - right).every((slot, index) => slot === index + 1) ? normalized : fallback;
}

function moveHitRange(move) {
  if (!move.multihit) return { min: 1, max: 1 };
  if (typeof move.multihit === "number") return { min: move.multihit, max: move.multihit };
  return { min: move.multihit[0], max: move.multihit[1] };
}

function abilityBlocksMove(target, move, knownAbility = target.getAbility().id) {
  const ability = toID(knownAbility);
  if (move.flags?.sound && ability === "soundproof") return true;
  if (move.flags?.bullet && ability === "bulletproof") return true;
  if (move.flags?.wind && ability === "windrider") return true;
  if (move.type === "Ground" && ["levitate", "eartheater"].includes(ability)) return true;
  if (move.type === "Fire" && ["flashfire", "wellbakedbody"].includes(ability)) return true;
  if (move.type === "Water" && ["dryskin", "stormdrain", "waterabsorb"].includes(ability)) return true;
  if (move.type === "Electric" && ["lightningrod", "motordrive", "voltabsorb"].includes(ability)) return true;
  if (move.type === "Grass" && ability === "sapsipper") return true;
  return false;
}

function estimatedBasePower(source, target, move, sourceItem = source.item, targetItem = target.item) {
  let power = Number(move.basePower) || 0;
  if (["nightshade", "seismictoss"].includes(move.id)) return source.level;
  if (move.id === "superfang") return Math.max(1, Math.floor(target.hp / 2));
  if (["return", "frustration"].includes(move.id)) return 102;
  if (["electroball", "gyroball", "grassknot", "heavyslam", "heatcrash", "lowkick"].includes(move.id)) power = 80;
  if (["storedpower", "powertrip"].includes(move.id)) power = 20 + 20 * Object.values(source.boosts).reduce((sum, boost) => sum + Math.max(0, boost), 0);
  if (["eruption", "waterspout", "dragonenergy"].includes(move.id)) power = Math.max(1, Math.floor(150 * source.hp / source.maxhp));
  if (["flail", "reversal"].includes(move.id)) power = source.hp * 4 <= source.maxhp ? 100 : 40;
  if (move.id === "brine" && target.hp * 2 <= target.maxhp) power *= 2;
  if (move.id === "facade" && source.status) power *= 2;
  if (move.id === "hex" && target.status) power *= 2;
  if (move.id === "venoshock" && ["psn", "tox"].includes(target.status)) power *= 2;
  if (move.id === "wakeupslap" && target.status === "slp") power *= 2;
  if (move.id === "acrobatics" && sourceItem === null) power *= 2;
  if (move.id === "knockoff" && targetItem && targetItem !== "__unknown__") power *= 1.5;
  if (move.id === "weatherball" && source.effectiveWeather()) power *= 2;
  return power;
}

function estimatedDamage(
  battle,
  source,
  target,
  move,
  knownTargetAbility = target?.getAbility().id,
  knownSourceAbility = source?.getAbility().id,
  knownSourceItem = source?.item,
  knownTargetItem = target?.item,
) {
  if (!source || !target || move.category === "Status") return null;
  const conversion = { aerilate: "Flying", galvanize: "Electric", normalize: "Normal", pixilate: "Fairy", refrigerate: "Ice" };
  const moveType = move.type === "Normal" && conversion[knownSourceAbility] ? conversion[knownSourceAbility] : move.type;
  const scrappyHit = knownSourceAbility === "scrappy" && ["Normal", "Fighting"].includes(moveType) && target.hasType("Ghost");
  const ignoresImmunity = scrappyHit || move.ignoreImmunity === true || move.ignoreImmunity?.[moveType];
  const effectiveMove = moveType === move.type ? move : { ...move, type: moveType };
  if ((!ignoresImmunity && !battle.dex.getImmunity(moveType, target)) || abilityBlocksMove(target, effectiveMove, knownTargetAbility)) return { min: 0, max: 0, average: 0 };
  if (move.ohko) {
    return { min: target.hp, max: target.hp, average: target.hp };
  }
  if (move.damage === "level" || ["nightshade", "seismictoss"].includes(move.id)) return { min: source.level, max: source.level, average: source.level };
  if (Number.isFinite(move.damage)) return { min: move.damage, max: move.damage, average: move.damage };
  let power = estimatedBasePower(source, target, move, knownSourceItem, knownTargetItem);
  if (!power) return { min: 0, max: 0, average: 0 };
  const hitRange = moveHitRange(move);
  power *= hitRange.max;
  const offensiveStat = move.id === "bodypress" ? "def" : move.category === "Physical" ? "atk" : "spa";
  const defensiveStat = ["psyshock", "psystrike", "secretsword"].includes(move.id) ? "def" : move.category === "Physical" ? "def" : "spd";
  const attackSource = move.id === "foulplay" ? target : source;
  // Forecasting happens outside move execution, so avoid ability/item callbacks
  // that expect battle.activeMove to exist. Boosts still apply to these values.
  let attack = Math.max(1, attackSource.getStat(offensiveStat, false, true));
  let defense = Math.max(1, target.getStat(defensiveStat, false, true));
  if (move.category === "Physical" && ["hugepower", "purepower"].includes(knownSourceAbility)) attack *= 2;
  if (move.category === "Physical" && ["guts", "gorillatactics", "hustle"].includes(knownSourceAbility) && (knownSourceAbility !== "guts" || source.status)) attack *= 1.5;
  if (move.category === "Special" && knownSourceAbility === "solarpower" && ["sunnyday", "desolateland"].includes(battle.field.weather)) attack *= 1.5;
  if ((move.category === "Physical" && knownSourceItem === "choiceband") || (move.category === "Special" && knownSourceItem === "choicespecs")) attack *= 1.5;
  if (knownTargetItem === "eviolite" && target.species.nfe) defense *= 1.5;
  if (knownTargetItem === "assaultvest" && move.category === "Special") defense *= 1.5;
  if (knownTargetAbility === "furcoat" && move.category === "Physical") defense *= 2;
  if (knownTargetAbility === "icescales" && move.category === "Special") defense *= 2;
  if (knownTargetAbility === "marvelscale" && move.category === "Physical" && target.status) defense *= 1.5;
  let maximum = Math.floor(Math.floor(Math.floor((2 * source.level) / 5 + 2) * power * attack / defense) / 50) + 2;
  if (source.hasType(moveType)) maximum = Math.floor(maximum * (knownSourceAbility === "adaptability" ? 2 : 1.5));
  const effectiveness = target.runEffectiveness(effectiveMove);
  if (toID(knownTargetAbility) === "wonderguard" && effectiveness <= 0) return { min: 0, max: 0, average: 0 };
  if (effectiveness > 0) maximum *= 2 ** effectiveness;
  else if (effectiveness < 0) maximum = Math.floor(maximum / (2 ** -effectiveness));
  maximum = Math.max(1, maximum);
  if (knownSourceItem === "lifeorb") maximum = Math.floor(maximum * 1.3);
  if (knownSourceItem === "expertbelt" && effectiveness > 0) maximum = Math.floor(maximum * 1.2);
  if ((knownSourceItem === "muscleband" && move.category === "Physical") || (knownSourceItem === "wiseglasses" && move.category === "Special")) maximum = Math.floor(maximum * 1.1);
  if (knownTargetAbility === "thickfat" && ["Fire", "Ice"].includes(moveType)) maximum = Math.max(1, Math.floor(maximum / 2));
  if (["filter", "prismarmor", "solidrock"].includes(knownTargetAbility) && effectiveness > 0) maximum = Math.max(1, Math.floor(maximum * 0.75));
  if ((move.category === "Physical" && target.side.sideConditions.reflect) || (move.category === "Special" && target.side.sideConditions.lightscreen) || target.side.sideConditions.auroraveil) maximum = Math.max(1, Math.floor(maximum / 2));
  const weather = battle.field.weather;
  if (["raindance", "primordialsea"].includes(weather)) maximum = Math.floor(maximum * (moveType === "Water" ? 1.5 : moveType === "Fire" ? 0.5 : 1));
  if (["sunnyday", "desolateland"].includes(weather)) maximum = Math.floor(maximum * (moveType === "Fire" ? 1.5 : moveType === "Water" ? 0.5 : 1));
  if (source.status === "brn" && move.category === "Physical" && knownSourceAbility !== "guts" && move.id !== "facade") maximum = Math.max(1, Math.floor(maximum / 2));
  const minimum = Math.max(1, Math.floor(maximum / hitRange.max * 0.85) * hitRange.min);
  const accuracy = move.accuracy === true ? 1 : Math.max(0, Number(move.accuracy) || 0) / 100;
  return { min: minimum, max: maximum, average: ((minimum + maximum) / 2) * accuracy };
}

function moveLikelyUsable(battle, source, target, move) {
  if (["fakeout", "firstimpression", "matblock"].includes(move.id) && source.activeMoveActions > 0) return false;
  if (["dreameater", "nightmare"].includes(move.id) && target.status !== "slp") return false;
  if (move.id === "poltergeist" && !target.item) return false;
  if (move.id === "steelroller" && !battle.field.terrain) return false;
  return true;
}

function fakeOutCanFlinch(knownAbility, knownItem) {
  return !["innerfocus", "shielddust"].includes(toID(knownAbility))
    && toID(knownItem) !== "covertcloak";
}

function knownGrounded(pokemon, battle, knownAbility, knownItem) {
  if (battle.field.pseudoWeather.gravity || pokemon.volatiles.ingrain || pokemon.volatiles.smackdown) return true;
  if (pokemon.hasType("Flying")) return false;
  if (toID(knownAbility) === "levitate" || toID(knownItem) === "airballoon") return false;
  return true;
}

function splitProtocol(line) {
  return line.slice(1).split("|");
}

function displayName(reference = "") {
  return reference.replace(/^p[12][a-f]?: /, "");
}

function sideFrom(reference = "") {
  if (reference.startsWith("p1")) return "player";
  if (reference.startsWith("p2")) return "opponent";
  return "system";
}

function slotFrom(reference = "") {
  return reference.split(":", 1)[0];
}

function sideSlotFrom(reference = "") {
  return reference.match(/^p[12]/)?.[0] || "";
}

function pokemonEffectKey(reference = "", effect = "") {
  return `${sideFrom(reference)}:${toID(displayName(reference))}:${toID(effect)}`;
}

function effectName(effect = "") {
  return effect.replace(/^(?:move|ability|item): /, "");
}

function conditionPercent(condition = "") {
  if (condition.startsWith("0 ") || condition === "0") return 0;
  const match = condition.match(/(\d+)\/(\d+)/);
  if (!match) return null;
  return Math.max(1, Math.round((Number(match[1]) / Number(match[2])) * 100));
}

const permanentItemTransferSources = new Set([
  "ability: magician", "ability: pickpocket",
  "move: covet", "move: switcheroo", "move: thief", "move: trick",
]);

export function acquisitionFromProtocol(line, record) {
  if (!line.startsWith("|-item|p1")) return null;
  const [, subject, itemName, ...annotations] = splitProtocol(line);
  const source = annotations.find((entry) => entry.startsWith("[from] "))?.slice(7).toLowerCase();
  if (!permanentItemTransferSources.has(source)) return null;
  const pokemonName = displayName(subject);
  const teamIndex = record.playerTeam.findIndex((set) => toID(set.name || set.species) === toID(pokemonName));
  const original = record.playerTeam[teamIndex];
  if (!original || original.item) return null;
  const pokemonId = playerTeamIds(record)[teamIndex];
  if (!pokemonId) return null;
  return { pokemonId, itemId: toID(itemName), source };
}

export function playerTeamIds(record) {
  if (Array.isArray(record.playerTeamIds) && record.playerTeamIds.length) return record.playerTeamIds;
  return [record.leadId, ...record.partyIds.filter((id) => id !== record.leadId)];
}

export function faintedPlayerIds(record, pokemon) {
  const ids = playerTeamIds(record);
  return pokemon.map((entry) => {
    if (!entry.fainted) return null;
    const originalName = entry.set?.name || entry.name;
    const originalSpecies = entry.set?.species || entry.baseSpecies?.name || entry.species?.baseSpecies || entry.species?.name;
    const index = record.playerTeam.findIndex((set) => (
      toID(set.name || set.species) === toID(originalName)
      || toID(set.species) === toID(originalSpecies)
    ));
    return index >= 0 ? ids[index] : null;
  }).filter(Boolean);
}

export function eventEntry(line, context) {
  if (!line.startsWith("|")) return null;
  const [type, subject, detail, extra] = splitProtocol(line);
  const name = displayName(subject);
  let side = sideFrom(subject);
  let text = null;
  let category = type.replace(/^-/, "") || "system";
  switch (type) {
    case "turn":
      context.logTurn = Number(subject);
      text = `Turn ${subject}`;
      category = "turn";
      break;
    case "move": text = `${name} used ${detail}!`; break;
    case "switch":
    case "drag": {
      const percent = conditionPercent(extra);
      if (percent != null) context.health.set(subject, percent);
      text = type === "drag" ? `${name} was dragged into battle.` : `${name} entered the battle.`;
      category = "switch";
      break;
    }
    case "faint":
      context.health.set(subject, 0);
      text = `${name} fainted!`;
      break;
    case "-damage":
    case "-heal": {
      const current = conditionPercent(detail);
      const previous = context.health.get(subject);
      if (current != null) context.health.set(subject, current);
      if (current == null) break;
      const change = previous == null ? null : Math.abs(current - previous);
      text = type === "-heal"
        ? change ? `${name} restored ${change}% HP.` : `${name}'s HP was restored to ${current}%.`
        : change ? `${name} lost ${change}% HP.` : `${name}'s HP fell to ${current}%.`;
      break;
    }
    case "-status": text = `${name} is now ${detail.toUpperCase()}.`; break;
    case "-curestatus": text = `${name} recovered from ${detail.toUpperCase()}.`; break;
    case "-start":
    case "-end": {
      const delayedMove = effectName(detail);
      if (!["futuresight", "doomdesire"].includes(toID(delayedMove))) break;
      text = type === "-start" ? `${name} set up ${delayedMove}.` : `${delayedMove} struck ${name}!`;
      category = "delayed";
      side = "system";
      break;
    }
    case "-supereffective": text = "It's super effective!"; break;
    case "-resisted": text = "It's not very effective."; break;
    case "-immune": text = `It doesn't affect ${name}.`; break;
    case "-miss": text = `${displayName(detail || subject)} avoided the attack.`; break;
    case "-crit": text = "A critical hit!"; break;
    case "-fail": text = `${name}'s action failed.`; break;
    case "cant": text = `${name} couldn't move${detail ? ` (${effectName(detail)})` : ""}.`; break;
    case "-ability": text = `${name}'s ${detail} activated.`; break;
    case "-item": text = `${name}'s ${detail} activated.`; break;
    case "-enditem": text = `${name} lost its ${detail}.`; break;
    case "-activate": text = `${name} activated ${effectName(detail)}.`; break;
    case "-boost": text = `${name}'s ${detail.toUpperCase()} rose${Number(extra) > 1 ? " sharply" : ""}.`; break;
    case "-unboost": text = `${name}'s ${detail.toUpperCase()} fell${Number(extra) > 1 ? " sharply" : ""}.`; break;
    case "-weather": text = detail === "none" ? "The weather cleared." : `${effectName(detail)} began.`; break;
    case "-fieldstart": text = `${effectName(detail)} took effect.`; break;
    case "-fieldend": text = `${effectName(detail)} ended.`; break;
    case "-sidestart": text = `${effectName(detail)} affected ${subject === "p1: Player" ? "your team" : `${context.record.trainerName || "Brock"}'s team`}.`; break;
    case "-sideend": text = `${effectName(detail)} ended for ${subject === "p1: Player" ? "your team" : `${context.record.trainerName || "Brock"}'s team`}.`; break;
    case "win": text = `${subject} won the battle.`; category = "result"; break;
    case "tie": text = "The battle ended in a tie."; category = "result"; break;
    default: break;
  }
  if (!text) return null;
  return { turn: context.logTurn, side, category, text };
}

function pokemonView(pokemon, ownSide) {
  const roundedPercent = pokemon.maxhp ? Math.round((pokemon.hp / pokemon.maxhp) * 100) : 0;
  const percent = pokemon.hp > 0 ? Math.max(1, roundedPercent) : 0;
  const species = pokemon.species;
  return {
    id: species?.id || toID(species?.name || pokemon.name),
    name: species?.name || pokemon.name,
    spriteId: species?.spriteid || species?.id || toID(species?.name || pokemon.name),
    shiny: Boolean(pokemon.set?.shiny || pokemon.details?.toLowerCase().includes(", shiny")),
    level: pokemon.level,
    hp: ownSide ? pokemon.hp : null,
    maxHp: ownSide ? pokemon.maxhp : null,
    percent,
    status: pokemon.status || "",
    active: pokemon.isActive,
    fainted: pokemon.fainted,
  };
}

export class BattleController {
  constructor(record, persist, settle = async () => {}) {
    this.record = record;
    this.persist = persist;
    this.settle = settle;
    this.stream = new BattleStream({ noCatch: true });
    this.streams = getPlayerStreams(this.stream);
    this.currentRequest = null;
    this.log = [];
    this.logTurn = 0;
    this.logSequence = 0;
    this.health = new Map();
    this.activeProfiles = new Map();
    this.lastMove = null;
    this.pendingKnockouts = new Map();
    this.sideConditionSources = new Map();
    this.pokemonEffectSources = new Map();
    this.weatherId = "";
    this.weatherSource = null;
    this.knockouts = [];
    this.version = 0;
    this.waiters = new Set();
    this.logWaiters = new Set();
    this.replayIndexes = { p1: 0, p2: 0 };
    this.failure = null;
    this.settlement = null;
  }

  async start() {
    void this.consumePlayer("p1");
    void this.consumePlayer("p2");
    void this.consumeSpectator();
    const playerTeam = Teams.pack(this.record.playerTeam || buildPlayerTeam(this.record.partyIds, this.record.leadId));
    const opponentTeam = Teams.pack(this.record.opponentTeam || buildBrockTeam());
    const trainerName = this.record.trainerName || "Brock";
    await this.streams.omniscient.write([
      `>start ${JSON.stringify({ formatid: FORMAT, seed: this.record.seed })}`,
      `>player p1 ${JSON.stringify({ name: "Player", team: playerTeam })}`,
      `>player p2 ${JSON.stringify({ name: trainerName, team: opponentTeam })}`,
    ].join("\n"));
    await this.waitForState(0);
    return this;
  }

  async consumePlayer(side) {
    try {
      for await (const chunk of this.streams[side]) {
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("|request|")) continue;
          const request = JSON.parse(line.slice(9));
          await this.handleRequest(side, request);
        }
      }
    } catch (error) {
      this.failure = error;
      console.error(`Battle ${this.record.id} ${side} stream failed:`, error);
    } finally {
      this.signalState();
    }
  }

  async consumeSpectator() {
    try {
      for await (const chunk of this.streams.spectator) {
        for (const line of chunk.split("\n")) {
          this.trackBattleResult(line);
          const acquisition = acquisitionFromProtocol(line, this.record);
          if (acquisition) {
            this.record.itemAcquisitions ||= [];
            const duplicate = this.record.itemAcquisitions.some((entry) => entry.pokemonId === acquisition.pokemonId && entry.itemId === acquisition.itemId);
            if (!duplicate) {
              this.record.itemAcquisitions.push(acquisition);
              await this.persist(this.record);
            }
          }
          const entry = eventEntry(line, this);
          if (entry) this.log.push({ id: ++this.logSequence, ...entry });
        }
        this.log = this.log.slice(-250);
        for (const resolve of this.logWaiters) resolve();
        this.logWaiters.clear();
      }
    } catch (error) {
      this.failure = error;
      console.error(`Battle ${this.record.id} spectator stream failed:`, error);
    } finally {
      for (const resolve of this.logWaiters) resolve();
      this.logWaiters.clear();
    }
  }

  profileFor(reference = "", details = "") {
    const slot = slotFrom(reference);
    const active = this.activeProfiles.get(slot);
    if (active && (!reference.includes(":") || toID(active.nickname) === toID(displayName(reference)))) return { ...active };
    const nickname = displayName(reference);
    const team = sideFrom(reference) === "opponent" ? this.record.opponentTeam : this.record.playerTeam;
    const set = (team || [])
      .find((candidate) => toID(candidate.name || candidate.species) === toID(nickname));
    const speciesName = details.split(",", 1)[0] || set?.species || nickname;
    const species = Dex.species.get(speciesName);
    return {
      side: sideFrom(reference),
      nickname: nickname || species.name,
      name: species.name || set?.species || nickname,
      id: species.id || toID(set?.species || nickname),
      spriteId: species.spriteid || species.id || toID(set?.species || nickname),
      shiny: Boolean(set?.shiny || details.toLowerCase().includes(", shiny")),
    };
  }

  trackBattleResult(line) {
    if (!line.startsWith("|")) return;
    const [type, subject, detail, ...annotations] = splitProtocol(line);
    if (type === "turn") {
      this.lastMove = null;
      this.turnActionSeen = false;
      return;
    }
    if (type === "switch" || type === "drag") {
      if ((this.stream.battle?.turn || 0) > 0) this.turnActionSeen = true;
      const profile = this.profileFor(subject, detail);
      this.activeProfiles.set(slotFrom(subject), profile);
      return;
    }
    if (type === "move") {
      if (!this.turnActionSeen && sideFrom(subject) === "player") this.inferChoiceScarf(subject, detail);
      this.turnActionSeen = true;
      this.lastMove = {
        turn: this.logTurn,
        attacker: this.profileFor(subject),
        moveId: toID(detail),
        target: annotations[0] ? this.profileFor(annotations[0]) : null,
        targetReference: annotations[0] || "",
        ordinaryMiss: false,
      };
      return;
    }
    if (type === "-cant") {
      this.turnActionSeen = true;
      return;
    }
    if (type === "-miss" && this.lastMove?.attacker?.side === "opponent") {
      this.lastMove.ordinaryMiss = true;
      return;
    }
    const annotatedSource = annotations.find((entry) => entry.startsWith("[of] "))?.slice(5) || "";
    const abilityText = [detail, ...annotations].find((entry) => /(?:^|\s)ability:\s/i.test(entry));
    const abilityName = abilityText?.match(/ability:\s*(.+)$/i)?.[1];
    const abilityHolder = sideFrom(annotatedSource) === "player" ? annotatedSource : subject;
    if (abilityName && sideFrom(abilityHolder) === "player") this.rememberPlayerKnowledge(abilityHolder, "ability", abilityName);
    if (type === "-ability" && sideFrom(subject) === "player") this.rememberPlayerKnowledge(subject, "ability", effectName(detail));
    const itemText = [detail, ...annotations].find((entry) => /(?:^|\s)item:\s/i.test(entry));
    const itemName = itemText?.match(/item:\s*(.+)$/i)?.[1];
    if (itemName && sideFrom(subject) === "player") this.rememberPlayerKnowledge(subject, "item", itemName);
    if (type === "-item" && sideFrom(subject) === "player") this.rememberPlayerKnowledge(subject, "item", effectName(detail));
    if (type === "-enditem" && sideFrom(subject) === "player") this.rememberPlayerKnowledge(subject, "noitem", null);
    if (type === "-sidestart") {
      const condition = toID(effectName(detail));
      const source = annotatedSource ? this.profileFor(annotatedSource) : this.lastMove?.attacker;
      if (condition && source) this.sideConditionSources.set(`${sideSlotFrom(subject)}:${condition}`, source);
      return;
    }
    if (type === "-sideend") {
      this.sideConditionSources.delete(`${sideSlotFrom(subject)}:${toID(effectName(detail))}`);
      return;
    }
    if (type === "-swapsideconditions") {
      for (const condition of hazardConditions) {
        const playerSource = this.sideConditionSources.get(`p1:${condition}`);
        const opponentSource = this.sideConditionSources.get(`p2:${condition}`);
        if (opponentSource) this.sideConditionSources.set(`p1:${condition}`, opponentSource);
        else this.sideConditionSources.delete(`p1:${condition}`);
        if (playerSource) this.sideConditionSources.set(`p2:${condition}`, playerSource);
        else this.sideConditionSources.delete(`p2:${condition}`);
      }
      return;
    }
    if (type === "-weather") {
      if (subject === "none") {
        this.weatherId = "";
        this.weatherSource = null;
      } else {
        this.weatherId = toID(subject);
        const source = annotatedSource ? this.profileFor(annotatedSource) : this.lastMove?.attacker;
        if (source) this.weatherSource = source;
      }
      return;
    }
    if (type === "-fieldstart") {
      const effect = toID(effectName(subject));
      if (effect.endsWith("terrain")) {
        const source = annotatedSource ? this.profileFor(annotatedSource) : this.lastMove?.attacker;
        this.aiState().terrainOwner = source?.side || null;
      }
      return;
    }
    if (type === "-fieldend" && toID(effectName(subject)).endsWith("terrain")) {
      this.aiState().terrainOwner = null;
      return;
    }
    if (type === "-status") {
      const status = toID(detail);
      if (["brn", "psn", "tox"].includes(status)) {
        let source = annotatedSource ? this.profileFor(annotatedSource) : null;
        if (!source && this.lastMove?.targetReference === subject) source = this.lastMove.attacker;
        if (!source && ["psn", "tox"].includes(status)) {
          source = this.sideConditionSources.get(`${sideSlotFrom(subject)}:toxicspikes`) || null;
        }
        if (source) this.pokemonEffectSources.set(pokemonEffectKey(subject, "status"), source);
      }
      return;
    }
    if (type === "-curestatus") {
      this.pokemonEffectSources.delete(pokemonEffectKey(subject, "status"));
      return;
    }
    if (type === "-start") {
      const effect = toID(effectName(detail));
      const source = annotatedSource ? this.profileFor(annotatedSource) : this.lastMove?.attacker;
      if (effect && source) this.pokemonEffectSources.set(pokemonEffectKey(subject, effect), source);
      return;
    }
    if (type === "-end") {
      this.pokemonEffectSources.delete(pokemonEffectKey(subject, effectName(detail)));
      return;
    }
    if (["-fail", "-immune"].includes(type) && this.lastMove?.attacker?.side === "opponent") {
      const active = this.stream.battle?.p2?.active?.[0];
      const pokemonKey = String(this.stream.battle?.p2?.pokemon?.indexOf(active));
      const ai = this.aiState();
      if (this.lastMove.moveId === "suckerpunch" && !ai.suckerPunchFailed.includes(pokemonKey)) ai.suckerPunchFailed.push(pokemonKey);
      if (utilityCooldownMoveIds.has(this.lastMove.moveId)) ai.moveCooldowns[`${pokemonKey}:${this.lastMove.moveId}`] = (this.stream.battle?.turn || this.logTurn) + 1;
      return;
    }
    if (type === "-damage" && this.lastMove?.attacker?.side === "opponent") {
      const indirectEffect = annotations.find((entry) => entry.startsWith("[from] "))?.slice(7) || "";
      const crashMove = toID(effectName(indirectEffect));
      if (crashMoveIds.has(crashMove) && !this.lastMove.ordinaryMiss) {
        const active = this.stream.battle?.p2?.active?.[0];
        const pokemonKey = String(this.stream.battle?.p2?.pokemon?.indexOf(active));
        this.aiState().moveCooldowns[`${pokemonKey}:${crashMove}`] = (this.stream.battle?.turn || this.logTurn) + 1;
      }
    }
    if (type === "-damage" && isFainted(detail)) {
      const sourceReference = annotatedSource;
      const indirectEffect = annotations.find((entry) => entry.startsWith("[from] "))?.slice(7) || "";
      const effectId = toID(effectName(indirectEffect));
      const hasIndirectSource = Boolean(indirectEffect);
      const directMove = !hasIndirectSource && this.lastMove?.targetReference === subject ? this.lastMove.attacker : null;
      const statusSource = ["brn", "psn", "tox"].includes(effectId)
        ? this.pokemonEffectSources.get(pokemonEffectKey(subject, "status"))
        : null;
      const sideConditionSource = this.sideConditionSources.get(`${sideSlotFrom(subject)}:${effectId}`);
      const persistentEffectSource = this.pokemonEffectSources.get(pokemonEffectKey(subject, effectId));
      const weatherSource = this.weatherId === effectId ? this.weatherSource : null;
      this.pendingKnockouts.set(subject, sourceReference
        ? this.profileFor(sourceReference)
        : directMove || statusSource || sideConditionSource || persistentEffectSource || weatherSource || null);
      return;
    }
    if (type !== "faint") return;
    const defeated = this.profileFor(subject);
    const credited = this.pendingKnockouts.has(subject)
      ? this.pendingKnockouts.get(subject)
      : this.lastMove?.targetReference === subject ? this.lastMove.attacker : null;
    this.pendingKnockouts.delete(subject);
    if (this.knockouts.some((entry) => entry.turn === this.logTurn && entry.defeated.side === defeated.side && entry.defeated.nickname === defeated.nickname)) return;
    this.knockouts.push({ turn: this.logTurn, defeated, credited: credited || null });
    const ai = this.aiState();
    if (defeated.side === "player" && ai.pendingDestiny) ai.pendingDestiny = null;
    if (defeated.side === "player" && credited?.side === "opponent" && ai.lastChoice?.moveId === "pursuit") {
      delete ai.pursuitBlocked[ai.lastChoice.pokemonKey];
    }
  }

  rememberPlayerKnowledge(reference, kind, value) {
    const battle = this.stream.battle;
    const slot = Number(slotFrom(reference).slice(1)) - 1;
    const pokemon = battle?.p1?.active?.[slot];
    if (!pokemon) return;
    const key = String(battle.p1.pokemon.indexOf(pokemon));
    const ai = this.aiState();
    if (kind === "ability") ai.knownPlayerAbilities[key] = toID(value);
    if (kind === "item") ai.knownPlayerItems[key] = toID(value);
    if (kind === "noitem") ai.knownPlayerItems[key] = null;
  }

  inferChoiceScarf(reference, moveName) {
    const battle = this.stream.battle;
    const player = battle?.p1?.active?.[0];
    const opponent = battle?.p2?.active?.[0];
    const ai = this.aiState();
    if (!player || !opponent || ![battle.turn, battle.turn - 1].includes(ai.lastChoice?.turn)) return;
    const key = this.playerKnowledgeKey(player, battle);
    if (Object.hasOwn(ai.knownPlayerItems, key)) return;
    const playerMove = Dex.moves.get(moveName);
    const opponentMove = Dex.moves.get(ai.lastChoice.moveId);
    if (!playerMove.exists || !opponentMove.exists || playerMove.priority !== opponentMove.priority) return;
    if (battle.field.pseudoWeather.trickroom || player.side.sideConditions.tailwind) return;
    const possibleAbilities = new Set(Object.values(player.species.abilities || {}).map(toID));
    const possibleOrderAbilities = new Set(["galewings", "prankster", "triage"]);
    if ([...possibleAbilities].some((ability) => possibleOrderAbilities.has(ability))) return;
    const weatherSpeedAbilities = {
      chlorophyll: ["sunnyday", "desolateland"],
      sandrush: ["sandstorm"],
      slushrush: ["hail", "snow"],
      swiftswim: ["raindance", "primordialsea"],
    };
    if ([...possibleAbilities].some((ability) => weatherSpeedAbilities[ability]?.includes(battle.field.weather))) return;
    if (possibleAbilities.has("surgesurfer") && battle.field.terrain === "electricterrain") return;
    if ((possibleAbilities.has("quickfeet") && player.status) || possibleAbilities.has("unburden")) return;
    const playerSpeed = player.getStat("spe", false, true);
    const opponentSpeed = this.effectiveSpeed(opponent, battle);
    if (playerSpeed <= opponentSpeed && Math.floor(playerSpeed * 1.5) > opponentSpeed) ai.knownPlayerItems[key] = "choicescarf";
  }

  async handleRequest(side, request) {
    if (request.wait) return;
    if (request.teamPreview) {
      const length = request.side.pokemon.length;
      const order = side === "p2" ? savedTeamOrder(this.record.opponentTeamOrder, length) : savedTeamOrder(null, length);
      await this.streams[side].write(`team ${order.join("")}`);
      return;
    }
    const saved = this.record.choices[side][this.replayIndexes[side]++];
    if (saved) {
      await this.streams[side].write(saved);
      return;
    }
    this.replayIndexes[side]--;
    if (side === "p2") {
      const choice = this.chooseBrockAction(request);
      this.record.choices.p2.push(choice);
      this.replayIndexes.p2++;
      await this.persist(this.record);
      await this.streams.p2.write(choice);
      return;
    }
    await new Promise((resolve) => setImmediate(resolve));
    request.nuzzleRqid = this.record.choices.p1.length + 1;
    this.currentRequest = request;
    this.signalState();
  }

  chooseBrockAction(request) {
    if (request.forceSwitch) {
      const ai = this.aiState();
      if (ai.lastActivePokemonKey != null) ai.setupStreaks[ai.lastActivePokemonKey] = 0;
      const pending = ai.pendingSwitch;
      ai.pendingSwitch = null;
      if (pending && request.side.pokemon[pending - 1] && !request.side.pokemon[pending - 1].active && !isFainted(request.side.pokemon[pending - 1].condition)) return `switch ${pending}`;
      return trainerReplacementChoice(request.side.pokemon);
    }
    const legalMoves = request.active?.[0]?.moves
      .map((choice, index) => ({ choice, move: Dex.moves.get(choice.id), slot: index + 1 }))
      .filter(({ choice, move }) => !choice.disabled && move.exists) || [];
    if (!legalMoves.length) return "move 1";
    const battle = this.stream.battle;
    const source = battle?.p2?.active?.[0];
    const target = battle?.p1?.active?.[0];
    if (!source || !target) return `move ${randomEntry(legalMoves).slot}`;
    const ai = this.aiState();
    const pokemonKey = String(battle.p2.pokemon.indexOf(source));
    const targetKey = String(battle.p1.pokemon.indexOf(target));
    if (ai.lastActivePokemonKey != null && ai.lastActivePokemonKey !== pokemonKey) ai.setupStreaks[ai.lastActivePokemonKey] = 0;
    ai.lastActivePokemonKey = pokemonKey;
    this.expireAiMemory(battle.turn);
    const evaluated = legalMoves.map((candidate) => ({
      ...candidate,
      damage: this.damageEstimate(battle, source, target, candidate.move),
    }));
    const lowerTierExcluded = new Set();
    const functional = evaluated.filter(({ move, damage }) => moveLikelyUsable(battle, source, target, move) && (
      !ai.suckerPunchFailed.includes(pokemonKey) || move.id !== "suckerpunch"
    ) && (!ai.moveCooldowns[`${pokemonKey}:${move.id}`] || ai.moveCooldowns[`${pokemonKey}:${move.id}`] < battle.turn)
      && (move.id !== "destinybond" || !ai.pendingDestiny)
      && (move.id !== "pursuit" || ai.pursuitBlocked[pokemonKey] !== battle.turn)
      && (!protectMoveIds.has(move.id) || ai.lastProtectTurn[pokemonKey] !== battle.turn - 1)
      && this.chargeMoveUsable(move, source, battle)
      && (move.id !== "poltergeist" || Boolean(ai.knownPlayerItems[targetKey]))
      && (move.category === "Status"
        ? this.statusMoveUseful(move, source, target)
        : damage?.max > 0 || utilityCooldownMoveIds.has(move.id)));
    const pool = functional;
    const faster = this.effectiveSpeed(source, battle) >= this.effectiveSpeed(target, battle);
    const incoming = this.incomingDamage(battle, target, source);
    const playerCanKo = incoming.some(({ damage }) => damage?.max >= source.hp);
    const legalSwitches = this.legalSwitchSlots(request);

    // 1. Escape Perish Song.
    if (source.volatiles.perishsong?.duration === 1 && legalSwitches.length) {
      const pursuit = pool.find(({ move, damage }) => move.id === "pursuit" && damage?.min * 2 >= target.hp);
      if (pursuit) return this.aiMoveChoice(pursuit, pokemonKey, source);
      return this.aiSwitchChoice(this.bestSwitchSlot(request, battle, target) || legalSwitches[0], pokemonKey);
    }

    // 2. Answer a faster possible KO with priority, including Sucker Punch.
    if (!faster && playerCanKo) {
      const priority = pool.filter(({ move, damage }) => move.category !== "Status" && move.priority > 0 && damage?.max > 0);
      const choice = tiedMoveChoice(priority, source);
      if (choice) return this.aiMoveChoice(choice, pokemonKey, source);
    }

    // 3. Take a guaranteed KO while moving first.
    const guaranteedKo = faster ? pool.filter(({ damage }) => damage?.min >= target.hp) : [];
    if (guaranteedKo.length) return this.aiMoveChoice(tiedMoveChoice(guaranteedKo, source), pokemonKey, source);

    // 4. Pursuit a target that would be KO'd while switching.
    const pursuit = pool.find(({ move, damage }) => move.id === "pursuit" && damage?.min * 2 >= target.hp);
    if (pursuit) return this.aiMoveChoice(pursuit, pokemonKey, source);

    const fakeOut = pool.find(({ move, damage }) => (
      move.id === "fakeout"
      && source.activeMoveActions === 0
      && damage?.max > 0
      && fakeOutCanFlinch(ai.knownPlayerAbilities[targetKey], ai.knownPlayerItems[targetKey])
    ));
    if (fakeOut) return this.aiMoveChoice(fakeOut, pokemonKey, source);

    // 6. Protect for useful passive recovery or passive damage.
    const protection = pool.filter(({ move }) => protectMoveIds.has(move.id));
    if (protection.length && ai.lastProtectTurn[pokemonKey] !== battle.turn - 1 && (this.hasPassiveRecovery(source, battle, target) || this.hasPassiveDamage(target, battle))) {
      return this.aiMoveChoice(tiedMoveChoice(protection, source), pokemonKey, source);
    }

    // 7. Take the highest damage-roll KO chance while moving first; accuracy only breaks ties.
    const potentialKo = faster ? pool.filter(({ damage }) => damage?.max >= target.hp && damage?.min < target.hp) : [];
    if (potentialKo.length) {
      const highestChance = Math.max(...potentialKo.map(({ damage }) => koChance(damage, target.hp)));
      return this.aiMoveChoice(tiedMoveChoice(potentialKo.filter(({ damage }) => koChance(damage, target.hp) === highestChance), source), pokemonKey, source);
    }

    // 8. Escape a faster incoming KO with a fast pivot.
    if (faster && playerCanKo && legalSwitches.length) {
      const pivot = pool.filter(({ move }) => pivotMoveIds.has(move.id));
      if (pivot.length) {
        ai.pendingSwitch = this.bestSwitchSlot(request, battle, target);
        return this.aiMoveChoice(tiedMoveChoice(pivot, source), pokemonKey, source);
      }
    }

    // 9. Resolve a pending Wish, then recover or cleanse.
    if (ai.wishPendingTurn === battle.turn) {
      const recipient = this.safeWishRecipient(request, battle, target);
      ai.wishPendingTurn = null;
      if (recipient) return this.aiSwitchChoice(recipient, pokemonKey);
      const playerHasSetup = target.moveSlots.some((slot) => setupMove(Dex.moves.get(slot.id), target));
      if (!playerHasSetup && protection.length) return this.aiMoveChoice(tiedMoveChoice(protection, source), pokemonKey, source);
    }
    const recoveryMoves = pool.filter(({ move }) => {
      if (!isRecoveryMove(move) || !this.recoveryMoveUseful(move, source, target)) return false;
      const projectedHp = move.id === "wish" ? source.hp : Math.min(source.maxhp, source.hp + this.recoveryAmount(source, target, move, battle));
      return !incoming.some(({ damage }) => damage?.max >= projectedHp);
    });
    if (source.hp * 2 <= source.maxhp && recoveryMoves.length) {
      const guaranteed = recoveryMoves.filter(({ move }) => this.recoveryBoosted(move, battle));
      if (guaranteed.length || this.hasPassiveDamage(target, battle) || crypto.randomInt(2) === 0) {
        return this.aiMoveChoice(tiedMoveChoice(guaranteed.length ? guaranteed : recoveryMoves, source), pokemonKey, source);
      }
      for (const { move } of recoveryMoves) lowerTierExcluded.add(move.id);
    }
    for (const { move } of pool.filter(({ move }) => isRecoveryMove(move))) lowerTierExcluded.add(move.id);
    const cleanse = pool.filter(({ move }) => cleanseMoveIds.has(move.id) && (
      move.id === "refresh" ? source.status : source.side.pokemon.some((pokemon) => !pokemon.fainted && pokemon.status)
    ));
    if (cleanse.length) return this.aiMoveChoice(tiedMoveChoice(cleanse, source), pokemonKey, source);

    // 10. Setup, with diminishing consecutive odds.
    if (!playerCanKo) {
      const setup = pool.filter(({ move }) => setupMove(move, source) && this.setupMoveUseful(move, source, battle));
      const count = ai.setupStreaks[pokemonKey] || 0;
      const chance = Math.max(0, 100 - count * 25);
      if (setup.length && crypto.randomInt(100) < chance) return this.aiMoveChoice(tiedMoveChoice(setup, source), pokemonKey, source);
    }
    for (const { move } of pool.filter(({ move }) => move.category === "Status" && setupMove(move, source))) lowerTierExcluded.add(move.id);

    // 11. Situational counters.
    const situational = pool.filter(({ move }) => !isRecoveryMove(move) && this.situationalMoveUseful(move, source, target));
    if (situational.length) return this.aiMoveChoice(tiedMoveChoice(situational, source), pokemonKey, source);

    // 12. Other useful status, arena control, and guaranteed effects.
    const statusMoves = pool.filter(({ move }) => !isRecoveryMove(move) && !protectMoveIds.has(move.id) && !pivotMoveIds.has(move.id)
      && !setupMove(move, source) && (move.category === "Status" || utilityCooldownMoveIds.has(move.id) || this.guaranteedUtility(move)));
    const urgentStatus = this.urgentStatusChoice(statusMoves, source, target, battle, incoming);
    if (urgentStatus) return this.aiMoveChoice(urgentStatus, pokemonKey, source);
    const status = this.otherStatusChoice(statusMoves, source, target, battle, lowerTierExcluded);
    if (status) return this.aiMoveChoice(status, pokemonKey, source);

    // 13. Slow pivot when it is safe to take the hit first.
    if (!faster && !playerCanKo && legalSwitches.length) {
      const pivot = pool.filter(({ move }) => pivotMoveIds.has(move.id));
      if (pivot.length) {
        ai.pendingSwitch = this.bestSwitchSlot(request, battle, target);
        return this.aiMoveChoice(tiedMoveChoice(pivot, source), pokemonKey, source);
      }
    }

    // 14. Ten percent hard switch, otherwise use any move that begins the shortest guaranteed damage line.
    if (legalSwitches.length && crypto.randomInt(10) === 0) return this.aiSwitchChoice(this.bestSwitchSlot(request, battle, target), pokemonKey);
    const damaging = pool.filter(({ move, damage }) => move.id !== "struggle" && damage?.max > 0);
    if (damaging.length) return this.aiMoveChoice(this.shortestDamageLine(damaging, target, source), pokemonKey, source);

    // 15. Random legal move, then switch rather than Struggle when no move works.
    const nonStruggle = functional.filter(({ move }) => move.id !== "struggle" && !lowerTierExcluded.has(move.id));
    if (nonStruggle.length) return this.aiMoveChoice(randomEntry(nonStruggle), pokemonKey, source);
    if (legalSwitches.length) return this.aiSwitchChoice(this.bestSwitchSlot(request, battle, target), pokemonKey);
    if (functional.length) return this.aiMoveChoice(randomEntry(functional), pokemonKey, source);
    return `move ${randomEntry(evaluated).slot}`;
  }

  aiMoveChoice(candidate, pokemonKey, source) {
    const ai = this.aiState();
    const turn = this.stream.battle.turn;
    const isSetup = setupMove(candidate.move, source) && candidate.move.id !== "substitute";
    ai.setupStreaks[pokemonKey] = isSetup ? (ai.setupStreaks[pokemonKey] || 0) + 1 : 0;
    if (protectMoveIds.has(candidate.move.id)) ai.lastProtectTurn[pokemonKey] = turn;
    if (candidate.move.id === "wish") ai.wishPendingTurn = turn + 1;
    if (candidate.move.id === "pursuit") ai.pursuitBlocked[pokemonKey] = turn + 1;
    if (candidate.move.id === "destinybond") ai.pendingDestiny = { pokemonKey, expires: turn + 1 };
    ai.lastChoice = { pokemonKey, moveId: candidate.move.id, turn };
    return `move ${candidate.slot}`;
  }

  aiSwitchChoice(slot, pokemonKey) {
    const ai = this.aiState();
    ai.setupStreaks[pokemonKey] = 0;
    ai.lastChoice = { pokemonKey, moveId: "", turn: this.stream.battle.turn, action: "switch" };
    return `switch ${slot}`;
  }

  aiState() {
    const ai = this.record.aiState ||= {};
    ai.suckerPunchFailed ||= [];
    ai.moveCooldowns ||= {};
    ai.setupStreaks ||= {};
    ai.lastProtectTurn ||= {};
    ai.pursuitBlocked ||= {};
    ai.knownPlayerAbilities ||= {};
    ai.knownPlayerItems ||= {};
    return ai;
  }

  expireAiMemory(turn) {
    const ai = this.aiState();
    if (ai.pendingDestiny && turn > ai.pendingDestiny.expires) {
      ai.moveCooldowns[`${ai.pendingDestiny.pokemonKey}:destinybond`] = turn + 1;
      ai.pendingDestiny = null;
    }
  }

  chargeMoveUsable(move, source, battle) {
    if (!move.flags?.charge) return true;
    if (source.hasItem("powerherb")) return true;
    return ["solarbeam", "solarblade"].includes(move.id) && ["sunnyday", "desolateland"].includes(battle.field.weather);
  }

  playerKnowledgeKey(pokemon, battle = this.stream.battle) {
    return String(battle?.p1?.pokemon?.indexOf(pokemon));
  }

  damageEstimate(battle, source, target, move) {
    const ai = this.aiState();
    const sourceIsPlayer = source.side === battle.p1;
    const targetIsPlayer = target.side === battle.p1;
    const sourceKey = this.playerKnowledgeKey(source, battle);
    const targetKey = this.playerKnowledgeKey(target, battle);
    const sourceItemKnown = Object.hasOwn(ai.knownPlayerItems, sourceKey);
    const targetItemKnown = Object.hasOwn(ai.knownPlayerItems, targetKey);
    const sourceAbility = sourceIsPlayer ? ai.knownPlayerAbilities[sourceKey] || "" : source.getAbility().id;
    const targetAbility = targetIsPlayer ? ai.knownPlayerAbilities[targetKey] || "" : target.getAbility().id;
    const sourceItem = sourceIsPlayer ? (sourceItemKnown ? ai.knownPlayerItems[sourceKey] : "__unknown__") : source.item || null;
    const targetItem = targetIsPlayer ? (targetItemKnown ? ai.knownPlayerItems[targetKey] : "__unknown__") : target.item || null;
    return estimatedDamage(battle, source, target, move, targetAbility, sourceAbility, sourceItem, targetItem);
  }

  effectiveSpeed(pokemon, battle = this.stream.battle) {
    let speed = pokemon.getStat("spe", false, true);
    const playerSide = pokemon.side === battle?.p1;
    const item = playerSide ? this.aiState().knownPlayerItems[this.playerKnowledgeKey(pokemon, battle)] : pokemon.item;
    const ability = playerSide ? this.aiState().knownPlayerAbilities[this.playerKnowledgeKey(pokemon, battle)] : pokemon.getAbility().id;
    if (item === "choicescarf") speed = Math.floor(speed * 1.5);
    if (["ironball", "machobrace", "poweranklet", "powerband", "powerbelt", "powerbracer", "powerlens", "powerweight"].includes(item)) speed = Math.floor(speed / 2);
    if (ability === "chlorophyll" && ["sunnyday", "desolateland"].includes(battle.field.weather)) speed *= 2;
    if (ability === "swiftswim" && ["raindance", "primordialsea"].includes(battle.field.weather)) speed *= 2;
    if (ability === "sandrush" && battle.field.weather === "sandstorm") speed *= 2;
    if (ability === "slushrush" && ["hail", "snow"].includes(battle.field.weather)) speed *= 2;
    if (ability === "quickfeet" && pokemon.status) speed = Math.floor(speed * 1.5);
    if (pokemon.status === "par" && ability !== "quickfeet") speed = Math.floor(speed / 2);
    return speed;
  }

  incomingDamage(battle, attacker, defender) {
    return attacker.moveSlots
      .filter((slot) => slot.pp > 0 && !slot.disabled)
      .map((slot) => ({ move: Dex.moves.get(slot.id), damage: this.damageEstimate(battle, attacker, defender, Dex.moves.get(slot.id)) }))
      .filter(({ damage }) => damage);
  }

  legalSwitchSlots(request) {
    if (request.active?.[0]?.trapped) return [];
    return request.side.pokemon
      .map((pokemon, index) => ({ pokemon, slot: index + 1 }))
      .filter(({ pokemon }) => !pokemon.active && !isFainted(pokemon.condition))
      .map(({ slot }) => slot);
  }

  bestSwitchSlot(request, battle, target) {
    const choices = this.legalSwitchSlots(request).map((slot) => {
      const pokemon = battle.p2.pokemon[slot - 1];
      const damage = pokemon.moveSlots.reduce((highest, moveSlot) => {
        if (moveSlot.pp <= 0 || moveSlot.disabled) return highest;
        const move = Dex.moves.get(moveSlot.id);
        if (!moveLikelyUsable(battle, pokemon, target, move) || !this.chargeMoveUsable(move, pokemon, battle)) return highest;
        const estimate = this.damageEstimate(battle, pokemon, target, move);
        return Math.max(highest, estimate?.max || 0);
      }, 0);
      return { slot, faster: this.effectiveSpeed(pokemon, battle) >= this.effectiveSpeed(target, battle), damage };
    });
    if (!choices.length) return null;
    const faster = choices.filter((choice) => choice.faster);
    const pool = faster.length ? faster : choices;
    const highest = Math.max(...pool.map(({ damage }) => damage));
    return randomEntry(pool.filter(({ damage }) => damage === highest)).slot;
  }

  hasPassiveRecovery(pokemon, battle, target) {
    if (pokemon.hp >= pokemon.maxhp) return false;
    if (pokemon.hasItem("leftovers") || pokemon.volatiles.ingrain || target?.volatiles.leechseed) return true;
    if (pokemon.hasAbility("raindish") && ["raindance", "primordialsea"].includes(battle.field.weather)) return true;
    return battle.field.terrain === "grassyterrain" && pokemon.isGrounded();
  }

  hasPassiveDamage(pokemon, battle) {
    const ability = pokemon.side === battle.p1
      ? this.aiState().knownPlayerAbilities[this.playerKnowledgeKey(pokemon, battle)] || ""
      : pokemon.getAbility().id;
    if (ability === "magicguard") return false;
    if (["psn", "tox"].includes(pokemon.status) && ability === "poisonheal") return false;
    if (["brn", "psn", "tox"].includes(pokemon.status)) return true;
    if (["leechseed", "saltcure", "curse", "partiallytrapped"].some((id) => pokemon.volatiles[id])) return true;
    if (ability === "overcoat") return false;
    if (battle.field.weather === "sandstorm" && ["sandforce", "sandrush", "sandveil"].includes(ability)) return false;
    return ["sandstorm", "hail"].includes(battle.field.weather) && !pokemon.hasType("Rock") && !pokemon.hasType("Ground") && !pokemon.hasType("Steel") && !pokemon.hasType("Ice");
  }

  safeWishRecipient(request, battle, target) {
    const safe = this.legalSwitchSlots(request).filter((slot) => {
      const pokemon = battle.p2.pokemon[slot - 1];
      if (pokemon.hp >= pokemon.maxhp) return false;
      const maximum = this.incomingDamage(battle, target, pokemon).reduce((value, entry) => Math.max(value, entry.damage?.max || 0), 0);
      return maximum < pokemon.hp && maximum <= pokemon.maxhp / 2;
    });
    return safe.length ? randomEntry(safe) : null;
  }

  recoveryAmount(source, target, move, battle) {
    if (move.id === "strengthsap") return Math.min(source.maxhp, target.getStat("atk", false, true));
    if (["morningsun", "moonlight", "synthesis"].includes(move.id)) {
      if (["sunnyday", "desolateland"].includes(battle.field.weather)) return source.maxhp * 2 / 3;
      return source.maxhp * (battle.field.weather ? 1 / 4 : 1 / 2);
    }
    if (move.id === "shoreup") return source.maxhp * (battle.field.weather === "sandstorm" ? 2 / 3 : 1 / 2);
    if (move.id === "rest") return source.maxhp;
    const fraction = move.heal || [1, 2];
    return source.maxhp * fraction[0] / fraction[1];
  }

  recoveryBoosted(move, battle) {
    return (["morningsun", "moonlight", "synthesis"].includes(move.id) && ["sunnyday", "desolateland"].includes(battle.field.weather))
      || (move.id === "shoreup" && battle.field.weather === "sandstorm");
  }

  setupMoveUseful(move, source, battle) {
    if (move.id === "substitute") return !source.volatiles.substitute && source.hp > source.maxhp / 4;
    const boosts = move.self?.boosts || (move.target === "self" ? move.boosts : null) || {};
    const contrary = source.hasAbility("contrary");
    const useful = Object.entries(boosts).some(([stat, amount]) => {
      const effective = contrary ? -amount : amount;
      return effective > 0 && source.boosts[stat] < 6;
    });
    if (!useful) return false;
    if (speedOnlySetupMoveIds.has(move.id)) {
      const ownSpeed = source.getStat("spe", false, true);
      const fastestPlayer = Math.max(...battle.p1.pokemon.filter((pokemon) => !pokemon.fainted).map((pokemon) => {
        const knownItem = this.aiState().knownPlayerItems[this.playerKnowledgeKey(pokemon, battle)];
        const scarfMultiplier = knownItem ? (knownItem === "choicescarf" ? 1.5 : 1) : 1.5;
        return pokemon.getStat("spe", false, true) * scarfMultiplier;
      }), 0);
      if (ownSpeed >= fastestPlayer) return false;
    }
    return true;
  }

  guaranteedUtility(move) {
    if (move.status) return true;
    if (move.boosts && Object.values(move.boosts).some((amount) => amount < 0)) return true;
    const effects = [move.secondary, ...(move.secondaries || [])].filter(Boolean);
    return effects.some((effect) => (effect.chance ?? 100) === 100 && (effect.status || effect.boosts));
  }

  urgentStatusChoice(candidates, source, target, battle, incoming) {
    const physicalKo = incoming.some(({ move, damage }) => move.category === "Physical" && damage?.max >= source.hp);
    if (physicalKo) {
      const physicalAnswer = candidates.filter(({ move }) => move.status === "brn" || (move.boosts?.atk || 0) <= -2);
      if (physicalAnswer.length) return tiedMoveChoice(physicalAnswer, source);
    }
    const knownItem = this.aiState().knownPlayerItems[this.playerKnowledgeKey(target, battle)];
    if (target.boosts.spa > 0 || knownItem === "choicespecs") {
      const specialAnswer = candidates.filter(({ move }) => (move.boosts?.spa || 0) < 0);
      if (specialAnswer.length) return tiedMoveChoice(specialAnswer, source);
    }
    const fasterThanSomeone = source.side.pokemon.some((pokemon) => !pokemon.fainted && this.effectiveSpeed(target, battle) > this.effectiveSpeed(pokemon, battle));
    if (fasterThanSomeone) {
      const speedAnswer = candidates.filter(({ move }) => move.status === "par" || (move.boosts?.spe || 0) < 0);
      if (speedAnswer.length) return tiedMoveChoice(speedAnswer, source);
    }
    return null;
  }

  otherStatusChoice(candidates, source, target, battle, rejected = new Set()) {
    let pool = [...candidates];
    while (pool.length) {
      const choice = tiedMoveChoice(pool, source);
      const condition = toID(choice.move.sideCondition || choice.move.id);
      if (["spikes", "toxicspikes"].includes(condition)) {
        const layers = target.side.sideConditions[condition]?.layers || 0;
        const chance = Math.max(10, 100 - layers * 30);
        if (crypto.randomInt(100) >= chance) {
          rejected.add(choice.move.id);
          pool = pool.filter((candidate) => candidate !== choice);
          continue;
        }
      }
      return choice;
    }
    return null;
  }

  shortestDamageLine(candidates, target, source) {
    const strongest = Math.max(...candidates.map(({ damage }) => damage?.min || 0));
    if (strongest <= 0) return tiedMoveChoice(candidates, source);
    const hits = Math.max(1, Math.ceil(target.hp / strongest));
    const eligible = candidates.filter(({ damage }) => (damage?.min || 0) + strongest * (hits - 1) >= target.hp);
    return tiedMoveChoice(eligible, source);
  }

  situationalMoveUseful(move, source, target) {
    const targetScreens = screenConditions.some((condition) => target.side.sideConditions[condition]);
    const positiveTargetBoost = Object.values(target.boosts).some((boost) => boost > 0);
    const ownHazards = hazardConditions.some((condition) => source.side.sideConditions[condition]);
    const playerTerrain = this.stream.battle.field.terrain && this.aiState().terrainOwner === "player";
    if (situationalScreenMoves.has(move.id) && targetScreens) return true;
    if (situationalBoostMoves.has(move.id) && positiveTargetBoost) return true;
    if (situationalHazardMoves.has(move.id) && ownHazards) return true;
    if (["icespinner", "steelroller", "defog"].includes(move.id) && playerTerrain) return true;
    if (["refresh", "junglehealing", "aromatherapy", "healbell"].includes(move.id) && (source.status || source.side.pokemon.some((pokemon) => pokemon.status))) return true;
    return false;
  }

  recoveryMoveUseful(move, source, target) {
    if (source.hp >= source.maxhp) return false;
    if (move.id === "rest" && source.status === "slp") return false;
    if (move.id === "strengthsap" && target.boosts.atk <= -6) return false;
    return true;
  }

  statusMoveUseful(move, source, target) {
    const battle = this.stream.battle;
    const targetKey = this.playerKnowledgeKey(target, battle);
    const knownAbility = this.aiState().knownPlayerAbilities[targetKey] || "";
    const knownItem = this.aiState().knownPlayerItems[targetKey];
    if (move.status && target.status) return false;
    if (move.status === "par" && (!this.stream.battle.dex.getImmunity("Electric", target) || target.hasType("Electric"))) return false;
    if (move.status === "psn" && (target.hasType("Poison") || target.hasType("Steel"))) return false;
    if (move.status === "tox" && (target.hasType("Poison") || target.hasType("Steel"))) return false;
    if (move.status === "brn" && target.hasType("Fire")) return false;
    if (move.status && ["comatose", "purifyingsalt"].includes(knownAbility)) return false;
    if (move.status === "par" && ["limber"].includes(knownAbility)) return false;
    if (["psn", "tox"].includes(move.status) && ["immunity", "pastelveil"].includes(knownAbility)) return false;
    if (move.status === "brn" && ["waterveil", "waterbubble"].includes(knownAbility)) return false;
    if (move.status === "slp" && ["insomnia", "vitalspirit", "sweetveil"].includes(knownAbility)) return false;
    if (move.status && target.volatiles.substitute && !move.flags?.sound && !source.hasAbility("infiltrator")) return false;
    if (move.status && target.side.sideConditions.safeguard && !source.hasAbility("infiltrator")) return false;
    if (move.status && battle.field.terrain === "mistyterrain" && knownGrounded(target, battle, knownAbility, knownItem)) return false;
    if (move.status === "slp" && battle.field.terrain === "electricterrain" && knownGrounded(target, battle, knownAbility, knownItem)) return false;
    if (move.weather && battle.field.weather === toID(move.weather)) return false;
    if (move.terrain && battle.field.terrain === toID(move.terrain)) return false;
    if (move.id === "auroraveil" && !["hail", "snow"].includes(battle.field.weather)) return false;
    if (move.pseudoWeather && battle.field.pseudoWeather[toID(move.pseudoWeather)]) return false;
    if (move.id === "perishsong" && (source.volatiles.perishsong || target.volatiles.perishsong)) return false;
    if (move.heal && source.hp >= source.maxhp) return false;
    const affectedSide = ["allySide", "allyTeam", "self"].includes(move.target) ? source.side : target.side;
    if (move.sideCondition && affectedSide.sideConditions[toID(move.sideCondition)]) {
      const condition = toID(move.sideCondition);
      const maxLayers = condition === "spikes" ? 3 : condition === "toxicspikes" ? 2 : 1;
      if ((affectedSide.sideConditions[condition].layers || 1) >= maxLayers) return false;
    }
    if (move.self?.sideCondition && source.side.sideConditions[toID(move.self.sideCondition)]) return false;
    const moveRecipient = move.target === "self" ? source : target;
    if (move.volatileStatus && moveRecipient.volatiles[toID(move.volatileStatus)]) return false;
    if (move.self?.volatileStatus && source.volatiles[toID(move.self.volatileStatus)]) return false;
    if (["fakeout", "firstimpression", "matblock"].includes(move.id) && source.activeMoveActions > 0) return false;
    const boosts = move.boosts || move.self?.boosts;
    if (boosts) {
      const affectsSelf = Boolean(move.self?.boosts) || move.target === "self";
      const recipient = affectsSelf ? source : target;
      const contrary = affectsSelf && source.hasAbility("contrary");
      const useful = Object.entries(boosts).some(([stat, amount]) => {
        const effective = contrary ? -amount : amount;
        return effective > 0 ? recipient.boosts[stat] < 6 : recipient.boosts[stat] > -6;
      });
      if (!useful) return false;
    }
    if (["haze", "topsyturvy"].includes(move.id) && !Object.values(target.boosts).some((boost) => boost > 0)) return false;
    if (move.id === "courtchange" && ![source.side, target.side].some((side) => [...screenConditions, ...hazardConditions].some((condition) => side.sideConditions[condition]))) return false;
    return true;
  }

  signalState() {
    this.version++;
    for (const resolve of this.waiters) resolve();
    this.waiters.clear();
  }

  async waitForState(previousVersion) {
    if (this.version > previousVersion || this.stream.battle?.ended || this.failure) return;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.delete(done);
        reject(new Error("The battle engine did not produce its next state in time."));
      }, 5000);
      const done = () => {
        clearTimeout(timer);
        resolve();
      };
      this.waiters.add(done);
    });
    if (this.failure) throw this.failure;
  }

  async waitForLogTurn(turn) {
    while (this.logTurn < turn && !this.failure) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.logWaiters.delete(done);
          reject(new Error("The battle log did not catch up to the battle state in time."));
        }, 5000);
        const done = () => {
          clearTimeout(timer);
          resolve();
        };
        this.logWaiters.add(done);
      });
    }
    if (this.failure) throw this.failure;
  }

  validateChoice(action) {
    const request = this.currentRequest;
    if (!request) choiceError("The battle is not waiting for a player choice.", 409);
    const slot = Number(action.slot);
    if (!Number.isInteger(slot) || slot < 1) choiceError("Invalid battle choice.");
    if (action.type === "move" && request.active) {
      const move = request.active[0]?.moves[slot - 1];
      if (!move || move.disabled) choiceError("That move is not currently usable.");
      return `move ${slot}`;
    }
    if (action.type === "switch" && (request.active || request.forceSwitch)) {
      if (request.active?.[0]?.trapped) choiceError("The active Pokémon cannot switch.");
      const pokemon = request.side.pokemon[slot - 1];
      if (!pokemon || pokemon.active || isFainted(pokemon.condition)) choiceError("That Pokémon cannot switch in.");
      return `switch ${slot}`;
    }
    choiceError("That choice is not legal right now.");
  }

  async choose(action, rqid) {
    if (this.record.dailyAttemptReset) choiceError("This battle has been reset.", 409);
    if (this.stream.battle?.ended) choiceError("This battle is already over.", 409);
    if (Number(rqid) !== this.currentRequest?.nuzzleRqid) choiceError("That choice belongs to an earlier turn. Please choose again.", 409);
    const choice = this.validateChoice(action);
    const previousTurn = this.stream.battle.turn;
    const previousVersion = this.version;
    this.currentRequest = null;
    this.record.choices.p1.push(choice);
    this.replayIndexes.p1++;
    await this.persist(this.record);
    await this.streams.p1.write(choice);
    await this.waitForState(previousVersion);
    if (this.stream.battle.turn > previousTurn) await this.waitForLogTurn(this.stream.battle.turn);
    await this.settleIfEnded();
    return this.state();
  }

  async forfeit() {
    if (this.record.dailyAttemptReset) choiceError("This battle has been reset.", 409);
    if (!this.stream.battle?.ended) {
      this.record.forfeited = true;
      await this.persist(this.record);
      const previousVersion = this.version;
      await this.streams.omniscient.write(">forcewin p2");
      await this.waitForState(previousVersion);
      await new Promise((resolve) => setImmediate(resolve));
    }
    await this.settleIfEnded();
    return this.state();
  }

  async settleIfEnded() {
    if (this.record.dailyAttemptReset || !this.stream.battle?.ended || this.record.itemsSettled) return;
    this.record.completedAt ||= new Date().toISOString();
    for (let attempt = 0; attempt < 20 && !this.log.some((entry) => entry.category === "result"); attempt++) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    if (!this.settlement) this.settlement = (async () => {
      const finalState = this.state();
      const faintedPokemonIds = this.record.forfeited
        ? playerTeamIds(this.record)
        : faintedPlayerIds(this.record, this.stream.battle.p1.pokemon);
      this.record.result = {
        winner: finalState.winner,
        playerWiped: Boolean(this.record.forfeited) || (finalState.player.team.length > 0 && finalState.player.team.every((pokemon) => pokemon.fainted)),
        faintedPokemonIds,
      };
      await this.settle(this.record);
      this.record.itemsSettled = true;
      await this.persist(this.record);
    })();
    await this.settlement;
  }

  state() {
    const battle = this.stream.battle;
    if (!battle) throw new Error("The battle has not initialized.");
    const request = this.currentRequest;
    const playerTeam = battle.p1.pokemon.map((pokemon) => pokemonView(pokemon, true));
    const opponentTeam = battle.p2.pokemon.map((pokemon) => pokemonView(pokemon, false));
    const moves = request?.active?.[0]?.moves.map((move, index) => {
      const data = Dex.moves.get(move.id);
      return {
        slot: index + 1,
        id: move.id,
        name: move.move,
        type: data.type,
        pp: move.pp,
        maxPp: move.maxpp,
        power: data.basePower || null,
        accuracy: data.accuracy === true ? null : data.accuracy,
        description: data.shortDesc || data.desc || "",
        disabled: Boolean(move.disabled),
      };
    }) || [];
    const forcedSwitch = Boolean(request?.forceSwitch?.some(Boolean));
    const trapped = Boolean(request?.active?.[0]?.trapped);
    return {
      id: this.record.id,
      rqid: request?.nuzzleRqid ?? null,
      turn: battle.turn,
      ended: battle.ended,
      winner: battle.winner || null,
      forfeited: Boolean(this.record.forfeited),
      waiting: !battle.ended && !request,
      forcedSwitch,
      player: {
        name: "Player",
        active: playerTeam.find((pokemon) => pokemon.active) || null,
        team: playerTeam.map((pokemon, index) => ({ ...pokemon, slot: index + 1, canSwitch: !pokemon.active && !pokemon.fainted && !trapped })),
      },
      opponent: {
        name: this.record.trainerName || "Brock",
        spriteId: this.record.trainerSpriteId || "brock",
        active: opponentTeam.find((pokemon) => pokemon.active) || null,
        team: opponentTeam,
      },
      challengeDate: this.record.challengeDate || null,
      challengeNumber: this.record.challengeNumber || null,
      knockouts: structuredClone(this.knockouts),
      moves,
      log: [...this.log],
      events: this.log.map((entry) => entry.text),
    };
  }
}

export class BattleService {
  constructor(store, { settle = async () => {} } = {}) {
    this.store = store;
    this.settle = settle;
    this.battles = new Map();
    this.dailyAttempts = new Set();
  }

  dailyAttemptKey(userId, challengeDate) {
    return userId && challengeDate ? `${userId}:${challengeDate}` : null;
  }

  hasDailyAttempt(userId, challengeDate) {
    const key = this.dailyAttemptKey(userId, challengeDate);
    return Boolean(key && this.dailyAttempts.has(key));
  }

  dailyBattle(userId, challengeDate) {
    return [...this.battles.values()]
      .filter((battle) => battle.record.userId === userId && battle.record.challengeDate === challengeDate && !battle.record.dailyAttemptReset)
      .sort((left, right) => String(right.record.createdAt).localeCompare(String(left.record.createdAt)))[0] || null;
  }

  dailyLeaderboard(challengeDate, userById) {
    return [...this.battles.values()]
      .filter((battle) => battle.record.challengeDate === challengeDate && !battle.record.dailyAttemptReset)
      .map((battle) => ({ battle, state: battle.state() }))
      .filter(({ state }) => state.ended)
      .map(({ battle, state }) => {
        const user = userById(battle.record.userId);
        if (!user) return null;
        const team = state.player.team.map((pokemon) => ({
          id: pokemon.id,
          name: pokemon.name,
          spriteId: pokemon.spriteId,
          shiny: pokemon.shiny,
          fainted: Boolean(battle.record.forfeited) || pokemon.fainted,
        }));
        return {
          username: user.username,
          avatarSpriteId: user.avatarSpriteId || null,
          won: state.winner === "Player",
          completedAt: battle.record.completedAt || battle.record.createdAt,
          fainted: team.filter((pokemon) => pokemon.fainted).length,
          teamSize: team.length,
          team,
        };
      })
      .filter(Boolean)
      .sort((left, right) => Number(right.won) - Number(left.won)
        || left.fainted - right.fainted
        || left.teamSize - right.teamSize
        || String(left.completedAt).localeCompare(String(right.completedAt)))
      .map((entry, index) => ({ rank: index + 1, ...entry }));
  }

  combinedLeaderboard(challengeDate, identityById, currentPlayerId = null) {
    const previousDate = (date) => {
      const value = new Date(`${date}T00:00:00Z`);
      value.setUTCDate(value.getUTCDate() - 1);
      return value.toISOString().slice(0, 10);
    };
    const attemptsByPlayer = new Map();
    for (const battle of this.battles.values()) {
      const { userId, challengeDate: date, dailyAttemptReset } = battle.record;
      if (!userId || !date || dailyAttemptReset) continue;
      const state = battle.state();
      if (!state.ended) continue;
      const attempts = attemptsByPlayer.get(userId) || new Map();
      const existing = attempts.get(date);
      if (!existing || String(battle.record.createdAt).localeCompare(String(existing.record.createdAt)) > 0) {
        attempts.set(date, { record: battle.record, state });
      }
      attemptsByPlayer.set(userId, attempts);
    }

    const entries = [];
    for (const [playerId, attempts] of attemptsByPlayer) {
      const today = attempts.get(challengeDate);
      if (!today) continue;
      const identity = identityById(playerId);
      if (!identity) continue;
      const won = today.state.winner === "Player";
      const team = today.state.player.team.map((pokemon) => ({
        id: pokemon.id,
        name: pokemon.name,
        spriteId: pokemon.spriteId,
        shiny: pokemon.shiny,
        fainted: !won || Boolean(today.record.forfeited) || pokemon.fainted,
      }));
      let streak = 0;
      if (!identity.isGuest) {
        let date = challengeDate;
        const identityBoundary = identity.streakStartDate || null;
        const streakBoundary = identityBoundary && identityBoundary > defaultLaunchDate ? identityBoundary : defaultLaunchDate;
        const hasSeasonBoundary = challengeDate >= streakBoundary;
        while ((!hasSeasonBoundary || date >= streakBoundary) && attempts.get(date)?.state.winner === "Player") {
          streak++;
          date = previousDate(date);
        }
      }
      const fainted = team.filter((pokemon) => pokemon.fainted).length;
      entries.push({
        username: identity.username,
        avatarSpriteId: identity.avatarSpriteId || null,
        isGuest: Boolean(identity.isGuest),
        isCurrentPlayer: playerId === currentPlayerId,
        won,
        completedAt: today.record.completedAt || today.record.createdAt,
        fainted,
        survivors: team.length - fainted,
        teamSize: team.length,
        streak,
        team,
      });
    }

    entries.sort((left, right) => Number(right.won) - Number(left.won)
      || left.fainted - right.fainted
      || right.streak - left.streak
      || left.teamSize - right.teamSize
      || String(left.completedAt).localeCompare(String(right.completedAt)));
    let rank = 0;
    let previousScore = null;
    return entries.map((entry) => {
      const score = `${Number(entry.won)}:${entry.fainted}:${entry.streak}:${entry.teamSize}:${entry.completedAt}`;
      if (score !== previousScore) {
        rank++;
        previousScore = score;
      }
      return { rank, ...entry };
    });
  }

  streakLeaderboard(challengeDate, userById) {
    const previousDate = (date) => {
      const value = new Date(`${date}T00:00:00Z`);
      value.setUTCDate(value.getUTCDate() - 1);
      return value.toISOString().slice(0, 10);
    };
    const attemptsByUser = new Map();
    for (const battle of this.battles.values()) {
      const { userId, challengeDate: date, dailyAttemptReset } = battle.record;
      if (!userId || !date || dailyAttemptReset) continue;
      const state = battle.state();
      if (!state.ended) continue;
      const attempts = attemptsByUser.get(userId) || new Map();
      const existing = attempts.get(date);
      if (!existing || String(battle.record.createdAt).localeCompare(String(existing.record.createdAt)) > 0) {
        attempts.set(date, { record: battle.record, won: state.winner === "Player" });
      }
      attemptsByUser.set(userId, attempts);
    }
    const entries = [];
    for (const [userId, attempts] of attemptsByUser) {
      const today = attempts.get(challengeDate);
      if (!today) continue;
      const user = userById(userId);
      if (!user) continue;
      let streak = 0;
      let date = challengeDate;
      const streakStartDate = defaultLaunchDate;
      const hasSeasonBoundary = challengeDate >= streakStartDate;
      while ((!hasSeasonBoundary || date >= streakStartDate) && attempts.get(date)?.won) {
        streak++;
        date = previousDate(date);
      }
      entries.push({
        username: user.username,
        avatarSpriteId: user.avatarSpriteId || null,
        streak,
        completedAt: today.record.completedAt || today.record.createdAt,
      });
    }
    return entries
      .sort((left, right) => right.streak - left.streak || String(left.completedAt).localeCompare(String(right.completedAt)))
      .map((entry, index) => ({ rank: index + 1, ...entry }));
  }

  async resetDailyAttempt(userId, challengeDate) {
    const matching = [...this.battles.values()].filter((battle) => (
      battle.record.userId === userId
      && battle.record.challengeDate === challengeDate
      && !battle.record.dailyAttemptReset
    ));
    for (const battle of matching) {
      battle.record.dailyAttemptReset = true;
      await this.store.save(battle.record);
    }
    const key = this.dailyAttemptKey(userId, challengeDate);
    if (key) this.dailyAttempts.delete(key);
  }

  async initialize() {
    for (const record of await this.store.loadAll()) {
      const attemptKey = this.dailyAttemptKey(record.userId, record.challengeDate);
      if (attemptKey && !record.dailyAttemptReset) this.dailyAttempts.add(attemptKey);
      try {
        const battle = new BattleController(record, (next) => this.store.save(next), this.settle);
        await battle.start();
        await battle.settleIfEnded();
        this.battles.set(record.id, battle);
      } catch (error) {
        console.error(`Could not replay battle ${record.id}:`, error);
      }
    }
  }

  async create({ partyIds, leadId, playerTeam = null, opponentTeam = null, trainerName = "Brock", trainerSpriteId = "brock", challengeDate = null, challengeNumber = null }, userId = null) {
    const attemptKey = this.dailyAttemptKey(userId, challengeDate);
    if (attemptKey && this.dailyAttempts.has(attemptKey)) choiceError("You already used today's daily battle attempt.", 409);
    const teamSnapshot = playerTeam || buildPlayerTeam(partyIds, leadId);
    const opponentSnapshot = opponentTeam || buildBrockTeam();
    if (!Array.isArray(teamSnapshot) || teamSnapshot.length < 1 || teamSnapshot.length > 6) choiceError("Choose between one and six Pokémon.");
    const record = {
      id: crypto.randomUUID(),
      userId,
      createdAt: new Date().toISOString(),
      format: FORMAT,
      seed: seed(),
      partyIds: [...partyIds],
      leadId,
      playerTeamIds: [leadId, ...partyIds.filter((id) => id !== leadId)],
      playerTeam: structuredClone(teamSnapshot),
      opponentTeam: structuredClone(opponentSnapshot),
      opponentTeamOrder: shuffledTeamOrder(opponentSnapshot.length),
      trainerName,
      trainerSpriteId,
      challengeDate,
      challengeNumber,
      choices: { p1: [], p2: [] },
      forfeited: false,
      itemAcquisitions: [],
      itemsSettled: false,
    };
    const firstAttempt = Boolean(attemptKey && !this.dailyAttempts.has(attemptKey));
    if (attemptKey) this.dailyAttempts.add(attemptKey);
    try {
      await this.store.save(record);
    } catch (error) {
      if (firstAttempt) this.dailyAttempts.delete(attemptKey);
      throw error;
    }
    const battle = new BattleController(record, (next) => this.store.save(next), this.settle);
    await battle.start();
    this.battles.set(record.id, battle);
    return battle.state();
  }

  get(id, userId = null) {
    const battle = this.battles.get(id);
    if (!battle) throw Object.assign(new Error("Battle not found."), { statusCode: 404 });
    if (userId && battle.record.userId !== userId) throw Object.assign(new Error("Battle not found."), { statusCode: 404 });
    return battle;
  }
}
