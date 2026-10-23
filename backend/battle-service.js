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

function slotFrom(reference = "") {
  return reference.split(":", 1)[0];
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
  const original = record.playerTeam.find((set) => toID(set.name || set.species) === toID(pokemonName));
  if (!original || original.item) return null;
  const pokemonId = record.partyIds.find((id) => toID(id) === toID(original.species || original.name));
  if (!pokemonId) return null;
  return { pokemonId, itemId: toID(itemName), source };
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
    this.knockouts = [];
    this.version = 0;
    this.waiters = new Set();
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
      }
    } catch (error) {
      this.failure = error;
      console.error(`Battle ${this.record.id} spectator stream failed:`, error);
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
    };
  }

  trackBattleResult(line) {
    if (!line.startsWith("|")) return;
    const [type, subject, detail, ...annotations] = splitProtocol(line);
    if (type === "turn") {
      this.lastMove = null;
      return;
    }
    if (type === "switch" || type === "drag") {
      const profile = this.profileFor(subject, detail);
      this.activeProfiles.set(slotFrom(subject), profile);
      return;
    }
    if (type === "move") {
      this.lastMove = {
        turn: this.logTurn,
        attacker: this.profileFor(subject),
        target: annotations[0] ? this.profileFor(annotations[0]) : null,
        targetReference: annotations[0] || "",
      };
      return;
    }
    if (type === "-damage" && isFainted(detail)) {
      const sourceReference = annotations.find((entry) => entry.startsWith("[of] "))?.slice(5) || "";
      const hasIndirectSource = annotations.some((entry) => entry.startsWith("[from] "));
      const directMove = !hasIndirectSource && this.lastMove?.targetReference === subject ? this.lastMove.attacker : null;
      this.pendingKnockouts.set(subject, sourceReference ? this.profileFor(sourceReference) : directMove);
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
    await this.settleIfEnded();
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
    await this.settleIfEnded();
    return this.state();
  }

  async settleIfEnded() {
    if (!this.stream.battle?.ended || this.record.itemsSettled) return;
    for (let attempt = 0; attempt < 20 && !this.log.some((entry) => entry.category === "result"); attempt++) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    if (!this.settlement) this.settlement = (async () => {
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
      opponentTeam: structuredClone(opponentTeam || buildBrockTeam()),
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
