const spread = {
  evs: { hp: 85, atk: 85, def: 85, spa: 85, spd: 85, spe: 85 },
  ivs: { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 },
  level: 100,
};

function invalidTeam(message) {
  throw Object.assign(new Error(message), { statusCode: 400 });
}

const playerSets = {
  flareon: { species: "Flareon", ability: "Flash Fire", item: "Charcoal", nature: "Adamant", moves: ["Flamethrower", "Quick Attack", "Bite", "Will-O-Wisp"] },
  raichu: { species: "Raichu", ability: "Static", item: "Magnet", nature: "Timid", moves: ["Thunderbolt", "Thunder Punch", "Surf", "Nasty Plot"] },
  vaporeon: { species: "Vaporeon", ability: "Water Absorb", item: "Leftovers", nature: "Bold", moves: ["Surf", "Ice Beam", "Shadow Ball", "Wish"] },
  gengar: { species: "Gengar", ability: "Cursed Body", item: "Spell Tag", nature: "Modest", moves: ["Shadow Ball", "Sludge Bomb", "Thunderbolt", "Hypnosis"] },
  venusaur: { species: "Venusaur", ability: "Overgrow", item: "Miracle Seed", nature: "Calm", moves: ["Giga Drain", "Sludge Bomb", "Earth Power", "Synthesis"] },
  pidgeot: { species: "Pidgeot", ability: "Keen Eye", item: "Sharp Beak", nature: "Jolly", moves: ["Air Slash", "U-turn", "Quick Attack", "Roost"] },
  arcanine: { species: "Arcanine", ability: "Intimidate", item: "Sitrus Berry", nature: "Adamant", moves: ["Flamethrower", "Crunch", "Extreme Speed", "Will-O-Wisp"] },
  lapras: { species: "Lapras", ability: "Water Absorb", item: "Leftovers", nature: "Modest", moves: ["Surf", "Ice Beam", "Thunderbolt", "Sing"] },
  alakazam: { species: "Alakazam", ability: "Synchronize", item: "Twisted Spoon", nature: "Timid", moves: ["Psychic", "Shadow Ball", "Energy Ball", "Calm Mind"] },
  machamp: { species: "Machamp", ability: "No Guard", item: "Black Belt", nature: "Adamant", moves: ["Dynamic Punch", "Knock Off", "Stone Edge", "Bullet Punch"] },
  nidoking: { species: "Nidoking", ability: "Sheer Force", item: "Life Orb", nature: "Timid", moves: ["Earth Power", "Sludge Bomb", "Ice Beam", "Thunderbolt"] },
  exeggutor: { species: "Exeggutor", ability: "Chlorophyll", item: "Sitrus Berry", nature: "Quiet", moves: ["Psychic", "Giga Drain", "Sludge Bomb", "Sleep Powder"] },
};

const brockSets = [
  { species: "Steelix", ability: "Sturdy", nature: "Adamant", moves: ["Earthquake", "Heavy Slam", "Rock Slide", "Stealth Rock"] },
  { species: "Golem", ability: "Sturdy", nature: "Adamant", moves: ["Earthquake", "Stone Edge", "Fire Punch", "Sucker Punch"] },
  { species: "Rhyperior", ability: "Solid Rock", nature: "Adamant", moves: ["Earthquake", "Rock Blast", "Megahorn", "Hammer Arm"] },
  { species: "Aerodactyl", ability: "Rock Head", nature: "Jolly", moves: ["Stone Edge", "Dual Wingbeat", "Crunch", "Earthquake"] },
  { species: "Sudowoodo", ability: "Rock Head", nature: "Adamant", moves: ["Head Smash", "Wood Hammer", "Earthquake", "Sucker Punch"] },
  { species: "Magcargo", ability: "Flame Body", nature: "Modest", moves: ["Lava Plume", "Power Gem", "Earth Power", "Recover"] },
];

function battleSet(id, definition) {
  return {
    name: definition.species,
    ...definition,
    ...spread,
    item: definition.item || "",
  };
}

export const PLAYER_IDS = Object.freeze(Object.keys(playerSets));

export function buildPlayerTeam(partyIds, leadId) {
  if (!Array.isArray(partyIds) || partyIds.length < 1 || partyIds.length > 6) {
    invalidTeam("Choose between one and six Pokémon.");
  }
  if (new Set(partyIds).size !== partyIds.length || partyIds.some((id) => !playerSets[id])) {
    invalidTeam("The party contains an unknown or duplicate Pokémon.");
  }
  if (!partyIds.includes(leadId)) invalidTeam("The selected lead must be in the party.");
  const ordered = [leadId, ...partyIds.filter((id) => id !== leadId)];
  return ordered.map((id) => battleSet(id, playerSets[id]));
}

export function buildBrockTeam() {
  return brockSets.map((set) => battleSet(set.species.toLowerCase(), set));
}

export function publicRoster() {
  return Object.fromEntries(Object.entries(playerSets).map(([id, set]) => [id, {
    id,
    name: set.species,
    ability: set.ability,
    item: set.item,
    nature: set.nature,
    moves: [...set.moves],
  }]));
}
