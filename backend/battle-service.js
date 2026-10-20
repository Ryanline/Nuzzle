import crypto from "node:crypto";
import { createRequire } from "node:module";
import { buildBrockTeam, buildPlayerTeam } from "./teams.js";

const require = createRequire(import.meta.url);
const { BattleStream, Dex, Teams, getPlayerStreams, toID } = require("pokemon-showdown");

const FORMAT = "gen9customgame";

function seed() {
  return Array.from({ length: 4 }, () => crypto.randomInt(0x10000));
}

function isFainted(condition = "") {
  return condition.endsWith(" fnt");
}

function choiceError(message, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode });
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

function effectName(effect = "") {
  return effect.replace(/^(?:move|ability|item): /, "");
}

function conditionPercent(condition = "") {
  if (condition.startsWith("0 ") || condition === "0") return 0;
  const match = condition.match(/(\d+)\/(\d+)/);
  if (!match) return null;
  return Math.max(1, Math.round((Number(match[1]) / Number(match[2])) * 100));
}

function eventEntry(line, context) {
  if (!line.startsWith("|")) return null;
  const [type, subject, detail, extra] = splitProtocol(line);
  const name = displayName(subject);
  const side = sideFrom(subject);
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
    case "-sidestart": text = `${effectName(detail)} affected ${subject === "p1: Player" ? "your team" : "Brock's team"}.`; break;
    case "-sideend": text = `${effectName(detail)} ended for ${subject === "p1: Player" ? "your team" : "Brock's team"}.`; break;
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
  return {
    id: toID(pokemon.name || pokemon.species?.name),
    name: pokemon.species?.name || pokemon.name,
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
  constructor(record, persist) {
    this.record = record;
    this.persist = persist;
    this.stream = new BattleStream({ noCatch: true });
    this.streams = getPlayerStreams(this.stream);
    this.currentRequest = null;
    this.log = [];
    this.logTurn = 0;
    this.logSequence = 0;
    this.health = new Map();
    this.version = 0;
    this.waiters = new Set();
    this.replayIndexes = { p1: 0, p2: 0 };
    this.failure = null;
  }

  async start() {
    void this.consumePlayer("p1");
    void this.consumePlayer("p2");
    void this.consumeSpectator();
    const playerTeam = Teams.pack(this.record.playerTeam || buildPlayerTeam(this.record.partyIds, this.record.leadId));
    const brockTeam = Teams.pack(buildBrockTeam());
    await this.streams.omniscient.write([
      `>start ${JSON.stringify({ formatid: FORMAT, seed: this.record.seed })}`,
      `>player p1 ${JSON.stringify({ name: "Player", team: playerTeam })}`,
      `>player p2 ${JSON.stringify({ name: "Brock", team: brockTeam })}`,
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
          const entry = eventEntry(line, this);
          if (entry) this.log.push({ id: ++this.logSequence, ...entry });
        }
        this.log = this.log.slice(-250);
      }
    } catch (error) {
      this.failure = error;
      console.error(`Battle ${this.record.id} spectator stream failed:`, error);
    }
  }

  async handleRequest(side, request) {
    if (request.wait) return;
    if (request.teamPreview) {
      await this.streams[side].write("team 123456".slice(0, 5 + request.side.pokemon.length));
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
      const slot = request.side.pokemon.findIndex((pokemon) => !pokemon.active && !isFainted(pokemon.condition));
      if (slot < 0) return "pass";
      return `switch ${slot + 1}`;
    }
    const legalMoves = request.active?.[0]?.moves
      .map((move, index) => ({ move, slot: index + 1 }))
      .filter(({ move }) => !move.disabled) || [];
    if (!legalMoves.length) return "move 1";
    return `move ${legalMoves[crypto.randomInt(legalMoves.length)].slot}`;
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
    if (this.stream.battle?.ended) choiceError("This battle is already over.", 409);
    if (Number(rqid) !== this.currentRequest?.nuzzleRqid) choiceError("That choice belongs to an earlier turn. Please choose again.", 409);
    const choice = this.validateChoice(action);
    const previousVersion = this.version;
    this.currentRequest = null;
    this.record.choices.p1.push(choice);
    this.replayIndexes.p1++;
    await this.persist(this.record);
    await this.streams.p1.write(choice);
    await this.waitForState(previousVersion);
    return this.state();
  }

  async forfeit() {
    if (!this.stream.battle?.ended) {
      this.record.forfeited = true;
      await this.persist(this.record);
      const previousVersion = this.version;
      await this.streams.omniscient.write(">forcewin p2");
      await this.waitForState(previousVersion);
      await new Promise((resolve) => setImmediate(resolve));
    }
    return this.state();
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
        name: "Brock",
        active: opponentTeam.find((pokemon) => pokemon.active) || null,
        team: opponentTeam,
      },
      moves,
      log: [...this.log],
      events: this.log.map((entry) => entry.text),
    };
  }
}

export class BattleService {
  constructor(store) {
    this.store = store;
    this.battles = new Map();
  }

  async initialize() {
    for (const record of await this.store.loadAll()) {
      try {
        const battle = new BattleController(record, (next) => this.store.save(next));
        await battle.start();
        this.battles.set(record.id, battle);
      } catch (error) {
        console.error(`Could not replay battle ${record.id}:`, error);
      }
    }
  }

  async create({ partyIds, leadId, playerTeam = null }, userId = null) {
    const teamSnapshot = playerTeam || buildPlayerTeam(partyIds, leadId);
    if (!Array.isArray(teamSnapshot) || teamSnapshot.length < 1 || teamSnapshot.length > 6) choiceError("Choose between one and six Pokémon.");
    const record = {
      id: crypto.randomUUID(),
      userId,
      createdAt: new Date().toISOString(),
      format: FORMAT,
      seed: seed(),
      partyIds: [...partyIds],
      leadId,
      playerTeam: structuredClone(teamSnapshot),
      choices: { p1: [], p2: [] },
      forfeited: false,
    };
    await this.store.save(record);
    const battle = new BattleController(record, (next) => this.store.save(next));
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
