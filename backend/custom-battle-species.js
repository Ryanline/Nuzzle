import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Dex, toID } = require("pokemon-showdown");

export const customBattleSpecies = Object.freeze([
  {
    name: "Angemon",
    types: ["Fairy", "Flying"],
    ability: "Serene Grace",
    baseStats: { hp: 75, atk: 105, def: 70, spa: 110, spd: 105, spe: 75 },
    heightm: 1.9,
    weightkg: 65,
  },
  {
    name: "Garurumon",
    types: ["Ice"],
    ability: "Intimidate",
    baseStats: { hp: 78, atk: 105, def: 80, spa: 90, spd: 70, spe: 111 },
    heightm: 2.1,
    weightkg: 110,
  },
  {
    name: "Gatomon",
    types: ["Fairy", "Electric"],
    ability: "Tough Claws",
    baseStats: { hp: 60, atk: 95, def: 65, spa: 80, spd: 100, spe: 120 },
    heightm: 0.6,
    weightkg: 9.5,
  },
  {
    name: "Greymon",
    types: ["Fire", "Dragon"],
    ability: "Strong Jaw",
    baseStats: { hp: 90, atk: 115, def: 90, spa: 100, spd: 69, spe: 70 },
    heightm: 4.5,
    weightkg: 450,
  },
  {
    name: "Kabuterimon",
    types: ["Bug", "Electric"],
    ability: "Battle Armor",
    baseStats: { hp: 85, atk: 95, def: 120, spa: 95, spd: 75, spe: 55 },
    heightm: 2.5,
    weightkg: 180,
  },
  {
    name: "Togemon",
    types: ["Grass", "Fighting"],
    ability: "Iron Fist",
    baseStats: { hp: 95, atk: 110, def: 90, spa: 65, spd: 75, spe: 80 },
    heightm: 1.5,
    weightkg: 80,
  },
].map((species, index) => Object.freeze({
  ...species,
  id: toID(species.name),
  num: -2001 - index,
  spriteId: `digimon/${toID(species.name)}`,
})));

export const customBattleSpeciesIds = Object.freeze(customBattleSpecies.map(({ id }) => id));

export function registerCustomBattleSpecies() {
  Dex.includeData();
  for (const species of customBattleSpecies) {
    const existing = Dex.data.Pokedex[species.id];
    if (existing && existing.name !== species.name) throw new Error(`Custom battle species ID conflicts with ${existing.name}: ${species.name}`);
    Dex.data.Pokedex[species.id] = {
      num: species.num,
      name: species.name,
      types: [...species.types],
      baseStats: { ...species.baseStats },
      abilities: { 0: species.ability },
      heightm: species.heightm,
      weightkg: species.weightkg,
      color: "White",
      eggGroups: ["Undiscovered"],
      gender: "N",
      gen: 9,
      isNonstandard: "Custom",
      spriteid: species.spriteId,
    };
    Dex.species.speciesCache.delete(species.id);
  }
  Dex.species.allCache = null;
}

registerCustomBattleSpecies();
