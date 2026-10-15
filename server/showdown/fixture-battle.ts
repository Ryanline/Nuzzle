import PokemonShowdown from "pokemon-showdown";

const { BattleStream, Teams } = PokemonShowdown;

const playerTeam = [
  {
    name: "Bulwark",
    species: "Blastoise",
    ability: "Torrent",
    item: "Leftovers",
    moves: ["surf", "icebeam", "flashcannon", "protect"],
    gender: "M" as const,
    nature: "Serious",
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    level: 100,
  },
];

const opponentTeam = [
  {
    name: "Cinder",
    species: "Arcanine",
    ability: "Intimidate",
    item: "Leftovers",
    moves: ["flamethrower", "extremespeed", "crunch", "protect"],
    gender: "M" as const,
    nature: "Serious",
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    level: 100,
  },
];

export interface FixtureBattleResult {
  formatId: string;
  winner: string | null;
  turns: number;
  transcript: string[];
}

export async function runFixtureBattle(): Promise<FixtureBattleResult> {
  const formatId = "gen9customgame";
  const stream = new BattleStream();
  const transcript: string[] = [];
  let winner: string | null = null;
  let turns = 0;

  const reader = (async () => {
    for await (const chunk of stream) {
      transcript.push(chunk);
      for (const line of chunk.split("\n")) {
        if (line.startsWith("|turn|")) turns = Number(line.slice(6));
        if (line.startsWith("|win|")) winner = line.slice(5);
      }

      if (chunk.startsWith("sideupdate\n")) {
        const [, side, requestLine] = chunk.split("\n");
        if (!requestLine?.startsWith("|request|")) continue;
        const request = JSON.parse(requestLine.slice("|request|".length)) as {
          active?: unknown;
          forceSwitch?: boolean[];
          teamPreview?: boolean;
          wait?: boolean;
        };
        if (request.wait) continue;

        const choice = request.teamPreview
          ? "team 1"
          : request.forceSwitch?.some(Boolean)
            ? "switch 1"
            : "move 1";
        stream.write(`>${side} ${choice}`);
      }
    }
  })();

  stream.write(`>start ${JSON.stringify({ formatid: formatId })}`);
  stream.write(`>player p1 ${JSON.stringify({ name: "Player", team: Teams.pack(playerTeam) })}`);
  stream.write(`>player p2 ${JSON.stringify({ name: "Trainer", team: Teams.pack(opponentTeam) })}`);

  await reader;
  return { formatId, winner, turns, transcript };
}

