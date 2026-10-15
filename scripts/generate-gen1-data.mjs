import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { Dex } = require("pokemon-showdown");

const excluded = new Set(["articuno", "zapdos", "moltres", "mewtwo", "mew"]);
const usefulStatus = [
  "recover", "roost", "softboiled", "rest", "synthesis", "morningsun", "slackoff",
  "swordsdance", "nastyplot", "calmmind", "agility", "dragondance", "bulkup",
  "toxic", "thunderwave", "willowisp", "sleeppowder", "spore", "hypnosis",
  "leechseed", "substitute", "protect", "reflect", "lightscreen", "stealthrock",
];

function scoreMove(move, types) {
  const accuracy = move.accuracy === true ? 100 : Number(move.accuracy || 0);
  const stab = types.includes(move.type) ? 32 : 0;
  const priority = Math.max(0, move.priority || 0) * 12;
  return move.basePower + stab + priority + accuracy / 20;
}

function movesFor(species) {
  const learnset = Dex.species.getLearnsetData(species.id).learnset || {};
  const moves = Object.keys(learnset)
    .map((id) => Dex.moves.get(id))
    .filter((move) => move.exists && !move.isZ && !move.isMax && move.id !== "hiddenpower");
  const damaging = moves
    .filter((move) => move.category !== "Status" && move.basePower > 0)
    .sort((a, b) => scoreMove(b, species.types) - scoreMove(a, species.types));
  const selected = [];

  for (const type of species.types) {
    const stab = damaging.find((move) => move.type === type && !selected.includes(move));
    if (stab) selected.push(stab);
  }
  for (const move of damaging) {
    if (selected.length >= 4) break;
    if (!selected.includes(move)) selected.push(move);
  }

  const status = usefulStatus
    .map((id) => moves.find((move) => move.id === id))
    .find(Boolean);
  if (status && selected.length >= 4) selected[3] = status;
  else if (status) selected.push(status);

  for (const move of moves) {
    if (selected.length >= 4) break;
    if (!selected.includes(move)) selected.push(move);
  }

  return selected.slice(0, 4).map((move) => [
    move.id,
    move.name,
    move.type,
    move.basePower,
    move.category === "Status" ? "status" : "ordinary",
  ]);
}

const species = Dex.species.all()
  .filter((mon) => mon.num >= 1 && mon.num <= 151 && mon.baseSpecies === mon.name && !excluded.has(mon.id))
  .sort((a, b) => a.num - b.num)
  .map((mon) => ({
    id: mon.id,
    name: mon.name,
    number: mon.num,
    types: mon.types,
    starter: ["venusaur", "charizard", "blastoise"].includes(mon.id),
    ability: mon.abilities["0"],
    moves: movesFor(mon),
  }));

const data = {
  species,
  trainers: {
    regular: { name: "Mira", title: "Ace Trainer", note: "Patient pivots and late-game pressure", team: [["gengar", "Leftovers", ["Shadow Ball", "Sludge Bomb", "Thunderbolt", "Hypnosis"]], ["arcanine", "Sitrus Berry", ["Flare Blitz", "Crunch", "Extreme Speed", "Will-O-Wisp"]], ["lapras", "Leftovers", ["Surf", "Ice Beam", "Thunderbolt", "Sing"]]] },
    gym: { name: "Sable", title: "Gym Leader", note: "A disciplined defensive specialist", team: [["magneton", "Eviolite", ["Thunderbolt", "Flash Cannon", "Volt Switch", "Thunder Wave"]], ["cloyster", "White Herb", ["Icicle Spear", "Liquidation", "Rock Blast", "Shell Smash"]], ["rhydon", "Eviolite", ["Earthquake", "Stone Edge", "Megahorn", "Stealth Rock"]]] },
    elite: { name: "Rowan", title: "Elite Four", note: "A balanced team with very few safe turns", team: [["alakazam", "Focus Sash", ["Psychic", "Shadow Ball", "Focus Blast", "Calm Mind"]], ["machamp", "Lum Berry", ["Close Combat", "Knock Off", "Stone Edge", "Bullet Punch"]], ["dragonite", "Leftovers", ["Dragon Claw", "Earthquake", "Extreme Speed", "Dragon Dance"]]] },
    champion: { name: "Vesper", title: "Champion", note: "The month's final shared challenge", team: [["snorlax", "Leftovers", ["Body Slam", "Earthquake", "Crunch", "Rest"]], ["starmie", "Life Orb", ["Surf", "Psychic", "Ice Beam", "Thunderbolt"]], ["dragonite", "Lum Berry", ["Dragon Claw", "Earthquake", "Extreme Speed", "Dragon Dance"]]] },
  },
  shop: [
    { id: "leftovers", name: "Leftovers", price: 1200, category: "Held item", description: "Restores a little HP at the end of each turn." },
    { id: "choicescarf", name: "Choice Scarf", price: 1600, category: "Held item", description: "Boosts Speed, but locks the holder into one move." },
    { id: "muscleband", name: "Muscle Band", price: 900, category: "Held item", description: "Slightly boosts the holder's physical attacks." },
  ],
};

const output = `window.NUZZLE_DATA = ${JSON.stringify(data, null, 2)};\n`;
await writeFile(resolve("dist/game-data.js"), output, "utf8");
console.log(`Generated ${species.length} eligible Gen 1 species.`);
