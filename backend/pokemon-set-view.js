import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Dex, toID } = require("pokemon-showdown");

export function pokemonSetView(set) {
  const species = Dex.species.get(set.species || set.name);
  return {
    id: species.id || toID(set.species || set.name),
    name: species.name || set.species || set.name,
    spriteId: species.spriteid || species.id || toID(set.species || set.name),
    shiny: Boolean(set.shiny),
    types: [...species.types],
    baseStats: { ...species.baseStats },
    ability: Dex.abilities.get(set.ability || species.abilities[0]).name || "None",
    item: Dex.items.get(set.item).name || "None",
    moves: set.moves.map((move) => Dex.moves.get(move).name),
  };
}
