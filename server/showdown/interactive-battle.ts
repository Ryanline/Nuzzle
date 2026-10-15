import * as PokemonShowdownModule from "pokemon-showdown";
import { randomUUID } from "node:crypto";

const PokemonShowdown = (PokemonShowdownModule as any).default || PokemonShowdownModule;
const { BattleStream, Dex, Teams } = PokemonShowdown;

export type TrainerTier = "regular" | "gym" | "elite" | "champion";

export interface PlayerTeamMember {
  speciesId: string;
  moves: string[];
}

export interface CreateBattleInput {
  party: PlayerTeamMember[];
  leadId?: string;
  trainerTier?: TrainerTier;
}

const excluded = new Set(["articuno", "zapdos", "moltres", "mewtwo", "mew"]);

const opponentTeams: Record<TrainerTier, Array<{ species: string; item: string; moves: string[] }>> = {
  regular: [
    { species: "Gengar", item: "Leftovers", moves: ["shadowball", "sludgebomb", "thunderbolt", "hypnosis"] },
    { species: "Arcanine", item: "Sitrus Berry", moves: ["flareblitz", "crunch", "extremespeed", "willowisp"] },
    { species: "Lapras", item: "Leftovers", moves: ["surf", "icebeam", "thunderbolt", "sing"] },
  ],
  gym: [
    { species: "Magneton", item: "Eviolite", moves: ["thunderbolt", "flashcannon", "voltswitch", "thunderwave"] },
    { species: "Cloyster", item: "White Herb", moves: ["iciclespear", "liquidation", "rockblast", "shellsmash"] },
    { species: "Rhydon", item: "Eviolite", moves: ["earthquake", "stoneedge", "megahorn", "stealthrock"] },
  ],
  elite: [
    { species: "Alakazam", item: "Focus Sash", moves: ["psychic", "shadowball", "focusblast", "calmmind"] },
    { species: "Machamp", item: "Lum Berry", moves: ["closecombat", "knockoff", "stoneedge", "bulletpunch"] },
    { species: "Dragonite", item: "Leftovers", moves: ["dragonclaw", "earthquake", "extremespeed", "dragondance"] },
  ],
  champion: [
    { species: "Snorlax", item: "Leftovers", moves: ["bodyslam", "earthquake", "crunch", "rest"] },
    { species: "Starmie", item: "Life Orb", moves: ["surf", "psychic", "icebeam", "thunderbolt"] },
    { species: "Dragonite", item: "Lum Berry", moves: ["dragonclaw", "earthquake", "extremespeed", "dragondance"] },
  ],
};

function battleSet(speciesName: string, moves: string[], item = "") {
  const mon = Dex.species.get(speciesName);
  return {
    name: mon.name,
    species: mon.name,
    ability: mon.abilities["0"],
    item,
    moves,
    gender: "" as const,
    nature: "Serious",
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    level: 100,
  };
}

function validateTeam(input: CreateBattleInput) {
  if (!Array.isArray(input.party) || input.party.length < 1 || input.party.length > 6) {
    throw new Error("Choose between one and six Pokémon.");
  }
  const seen = new Set<string>();
  const members = input.party.map((entry) => {
    const mon = Dex.species.get(entry.speciesId);
    if (!mon.exists || mon.num < 1 || mon.num > 151 || mon.baseSpecies !== mon.name || excluded.has(mon.id)) {
      throw new Error(`${entry.speciesId} is not eligible for this Kanto run.`);
    }
    if (seen.has(mon.id)) throw new Error("A battle party cannot contain duplicate species.");
    seen.add(mon.id);
    const moves = [...new Set(entry.moves || [])].slice(0, 4).map((id) => Dex.moves.get(id));
    if (!moves.length || moves.some((move) => !move.exists)) throw new Error(`${mon.name} has an invalid moveset.`);
    return battleSet(mon.name, moves.map((move) => move.id));
  });
  const leadIndex = Math.max(0, members.findIndex((member) => Dex.toID(member.species) === Dex.toID(input.leadId || "")));
  return [members[leadIndex], ...members.slice(0, leadIndex), ...members.slice(leadIndex + 1)];
}

function requestIsActionable(request: any) {
  return request && !request.wait && (request.teamPreview || request.forceSwitch?.some(Boolean) || request.active);
}

function firstLegalChoice(request: any) {
  if (request.teamPreview) return `team ${request.side.pokemon.map((_: unknown, index: number) => index + 1).join("")}`;
  if (request.forceSwitch?.some(Boolean)) {
    const index = request.side.pokemon.findIndex((pokemon: any) => !pokemon.active && !pokemon.condition.includes("fnt"));
    return `switch ${index + 1}`;
  }
  const moves = request.active?.[0]?.moves || [];
  const index = moves.findIndex((move: any) => !move.disabled && move.pp !== 0);
  return `move ${Math.max(1, index + 1)}`;
}

function conditionPercent(condition = "0 fnt") {
  if (condition.includes("fnt")) return 0;
  const match = condition.match(/(\d+)(?:\/(\d+)|%)/);
  if (!match) return 100;
  return match[2] ? Math.round((Number(match[1]) / Number(match[2])) * 100) : Number(match[1]);
}

export class InteractiveBattle {
  readonly id = randomUUID();
  readonly createdAt = Date.now();
  private readonly stream = new BattleStream();
  private readonly requests: Record<"p1" | "p2", any> = { p1: null, p2: null };
  private readonly waiters = new Set<() => void>();
  private readonly log: string[] = [];
  private opponent = { species: "", condition: "100/100", fainted: false };
  private winner: string | null = null;
  private ended = false;

  constructor(input: CreateBattleInput) {
    const player = validateTeam(input);
    const tier = input.trainerTier && opponentTeams[input.trainerTier] ? input.trainerTier : "regular";
    const opponent = opponentTeams[tier].map((set) => battleSet(set.species, set.moves, set.item));
    void this.consume();
    void this.stream.write(`>start ${JSON.stringify({ formatid: "gen9customgame" })}`);
    void this.stream.write(`>player p1 ${JSON.stringify({ name: "You", team: Teams.pack(player) })}`);
    void this.stream.write(`>player p2 ${JSON.stringify({ name: "Trainer", team: Teams.pack(opponent) })}`);
  }

  private notify() {
    const waiters = [...this.waiters];
    this.waiters.clear();
    for (const resolve of waiters) resolve();
  }

  private async consume() {
    for await (const chunk of this.stream) {
      const [type, ...parts] = chunk.split("\n");
      if (type === "sideupdate") {
        const side = parts.shift() as "p1" | "p2";
        const requestLine = parts.find((line: string) => line.startsWith("|request|"));
        if (requestLine) this.requests[side] = JSON.parse(requestLine.slice(9));
      } else if (type === "update") {
        for (const line of parts.filter(Boolean)) {
          this.log.push(line);
          this.readPublicLine(line);
        }
      }
      this.notify();
    }
    this.ended = true;
    this.notify();
  }

  private readPublicLine(line: string) {
    const parts = line.split("|");
    const command = parts[1];
    if ((command === "switch" || command === "drag") && parts[2]?.startsWith("p2")) {
      this.opponent = { species: parts[3].split(",")[0], condition: parts[4], fainted: false };
    }
    if ((command === "-damage" || command === "-heal") && parts[2]?.startsWith("p2")) {
      this.opponent.condition = parts[3];
      this.opponent.fainted = parts[3].includes("fnt");
    }
    if (command === "faint" && parts[2]?.startsWith("p2")) this.opponent.fainted = true;
    if (command === "win") {
      this.winner = parts[2] || null;
      this.ended = true;
    }
    if (command === "tie") this.ended = true;
  }

  private waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
    if (predicate()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.waiters.delete(onUpdate);
        reject(new Error("The battle simulator did not respond in time."));
      }, timeoutMs);
      const onUpdate = () => {
        if (!predicate()) {
          this.waiters.add(onUpdate);
          return;
        }
        clearTimeout(timeout);
        resolve();
      };
      this.waiters.add(onUpdate);
    });
  }

  private async waitForBothRequests() {
    await this.waitFor(() => this.ended || Boolean(this.requests.p1 && this.requests.p2));
  }

  async start() {
    await this.waitForBothRequests();
    if (this.requests.p1?.teamPreview && this.requests.p2?.teamPreview) {
      const p1Choice = firstLegalChoice(this.requests.p1);
      const p2Choice = firstLegalChoice(this.requests.p2);
      this.requests.p1 = null;
      this.requests.p2 = null;
      void this.stream.write(`>p1 ${p1Choice}`);
      void this.stream.write(`>p2 ${p2Choice}`);
    }
    await this.advanceUntilPlayerChoice();
    return this.snapshot();
  }

  private async advanceUntilPlayerChoice() {
    while (!this.ended) {
      await this.waitForBothRequests();
      if (this.ended || requestIsActionable(this.requests.p1)) return;
      if (this.requests.p1?.wait && requestIsActionable(this.requests.p2)) {
        const choice = firstLegalChoice(this.requests.p2);
        this.requests.p1 = null;
        this.requests.p2 = null;
        void this.stream.write(`>p2 ${choice}`);
        continue;
      }
      return;
    }
  }

  private validateChoice(choice: string) {
    const request = this.requests.p1;
    const match = choice.match(/^(move|switch) (\d+)$/);
    if (!match || !requestIsActionable(request)) throw new Error("That action is not available right now.");
    const index = Number(match[2]) - 1;
    if (match[1] === "move") {
      const move = request.active?.[0]?.moves?.[index];
      if (!move || move.disabled || move.pp === 0 || request.forceSwitch?.some(Boolean)) throw new Error("That move is not available.");
    } else {
      const pokemon = request.side?.pokemon?.[index];
      if (!pokemon || pokemon.active || pokemon.condition.includes("fnt") || request.active?.[0]?.trapped) throw new Error("That switch is not available.");
    }
  }

  async choose(choice: string) {
    if (this.ended) throw new Error("This battle is already over.");
    this.validateChoice(choice);
    const opponentChoice = requestIsActionable(this.requests.p2) ? firstLegalChoice(this.requests.p2) : null;
    this.requests.p1 = null;
    this.requests.p2 = null;
    void this.stream.write(`>p1 ${choice}`);
    if (opponentChoice) void this.stream.write(`>p2 ${opponentChoice}`);
    await this.advanceUntilPlayerChoice();
    return this.snapshot();
  }

  snapshot() {
    const request = this.requests.p1;
    const party = (request?.side?.pokemon || []).map((pokemon: any, index: number) => ({
      slot: index + 1,
      ident: pokemon.ident,
      species: pokemon.details.split(",")[0],
      condition: pokemon.condition,
      hpPercent: conditionPercent(pokemon.condition),
      active: pokemon.active,
      fainted: pokemon.condition.includes("fnt"),
    }));
    const active = party.find((pokemon: any) => pokemon.active) || party[0] || null;
    const moves = (request?.active?.[0]?.moves || []).map((move: any, index: number) => ({
      slot: index + 1,
      id: move.id,
      name: move.move,
      pp: move.pp,
      maxpp: move.maxpp,
      target: move.target,
      disabled: Boolean(move.disabled),
      type: Dex.moves.get(move.id).type || "Normal",
    }));
    return {
      id: this.id,
      ended: this.ended,
      winner: this.winner,
      turn: [...this.log].reverse().map((line) => line.match(/^\|turn\|(\d+)/)?.[1]).find(Boolean) || "1",
      log: this.log,
      request: {
        forceSwitch: Boolean(request?.forceSwitch?.some(Boolean)),
        trapped: Boolean(request?.active?.[0]?.trapped),
        moves,
        party,
      },
      player: active,
      opponent: {
        ...this.opponent,
        id: Dex.toID(this.opponent.species),
        hpPercent: conditionPercent(this.opponent.condition),
      },
    };
  }
}

export class InteractiveBattleStore {
  private readonly battles = new Map<string, InteractiveBattle>();

  async create(input: CreateBattleInput) {
    const battle = new InteractiveBattle(input);
    this.battles.set(battle.id, battle);
    return battle.start();
  }

  get(id: string) {
    const battle = this.battles.get(id);
    if (!battle) throw new Error("Battle not found.");
    return battle;
  }
}
