import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { Dex, toID } = require("pokemon-showdown");
const projectDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const approvalsFilename = path.join(projectDirectory, "other", "data", "nuzzle-approvals.csv");

function parseCsv(source) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index++;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  const headers = rows.shift().map((header) => header.trim());
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() || ""])));
}

const explicitSpecies = new Map(Object.entries({
  "Tauros Paldean Form Combat Breed": "taurospaldeacombat",
  "Tauros Paldean Form Blaze Breed": "taurospaldeablaze",
  "Tauros Paldean Form Aqua Breed": "taurospaldeaaqua",
  "Rotom Rotom": "rotom",
  "Aegislash Shield Forme": "aegislash",
  "Aegislash Blade Forme": "aegislash",
  "Lycanroc Midday Form": "lycanroc",
  "Lycanroc Midnight Form": "lycanrocmidnight",
  "Lycanroc Dusk Form": "lycanrocdusk",
  "Wishiwashi Solo Form": "wishiwashi",
  "Wishiwashi School Form": "wishiwashi",
  "Minior Meteor Form": "minior",
  "Minior Red Core": "minior",
  "Eiscue Ice Face": "eiscue",
  "Eiscue Noice Face": "eiscue",
  "Palafin Zero Form": "palafin",
  "Palafin Hero Form": "palafin",
  "Gourgeist Small Variety": "gourgeistsmall",
  "Gourgeist Medium Variety": "gourgeist",
  "Gourgeist Large Variety": "gourgeistlarge",
  "Gourgeist Jumbo Variety": "gourgeistsuper",
  "Wormadam Plant Cloak": "wormadam",
  "Wormadam Sandy Cloak": "wormadamsandy",
  "Wormadam Trash Cloak": "wormadamtrash",
  "Indeedee Male": "indeedee",
  "Indeedee Female": "indeedeef",
  "Oinkologne Male": "oinkologne",
  "Oinkologne Female": "oinkolognef",
  "Basculegion Male": "basculegion",
  "Basculegion Female": "basculegionf",
  "Darmanitan Standard Mode": "darmanitan",
  "Darmanitan Galarian Form Standard Mode": "darmanitangalar",
}));

function canonicalSpeciesId(label) {
  const flat = label.replace(/\s+/g, " ").trim();
  if (explicitSpecies.has(flat)) return explicitSpecies.get(flat);
  const regional = flat
    .replace(" Alolan Form", " Alola")
    .replace(" Galarian Form", " Galar")
    .replace(" Hisuian Form", " Hisui")
    .replace(" Paldean Form", " Paldea");
  const species = Dex.species.get(regional);
  if (!species.exists) throw new Error(`Unknown approved Pokémon: ${JSON.stringify(label)}`);
  return species.id;
}

const groupedForms = Object.freeze({
  gourgeist: ["gourgeistsmall", "gourgeist", "gourgeistlarge", "gourgeistsuper"],
  oricorio: ["oricorio", "oricoriopompom", "oricoriopau", "oricoriosensu"],
  basculin: ["basculin", "basculinbluestriped", "basculinwhitestriped"],
  toxtricity: ["toxtricity", "toxtricitylowkey"],
  meowstic: ["meowstic", "meowsticf"],
  squawkabilly: ["squawkabilly", "squawkabillyblue", "squawkabillyyellow", "squawkabillywhite"],
  tatsugiri: ["tatsugiri", "tatsugiridroopy", "tatsugiristretchy"],
  gastrodon: ["gastrodon", "gastrodoneast"],
  wormadam: ["wormadam", "wormadamsandy", "wormadamtrash"],
  lycanroc: ["lycanroc", "lycanrocmidnight", "lycanrocdusk"],
  indeedee: ["indeedee", "indeedeef"],
  oinkologne: ["oinkologne", "oinkolognef"],
  basculegion: ["basculegion", "basculegionf"],
  taurospaldea: ["taurospaldeacombat", "taurospaldeablaze", "taurospaldeaaqua"],
});

const starterIds = new Set([
  "venusaur", "charizard", "blastoise", "meganium", "typhlosion", "feraligatr",
  "sceptile", "blaziken", "swampert", "torterra", "infernape", "empoleon",
  "serperior", "emboar", "samurott", "chesnaught", "delphox", "greninja",
  "decidueye", "incineroar", "primarina", "rillaboom", "cinderace", "inteleon",
  "meowscarada", "skeledirge", "quaquaval", "typhlosionhisui", "samurotthisui",
  "decidueyehisui",
]);

const csvRows = parseCsv(await readFile(approvalsFilename, "utf8"));
const approvedSpeciesIds = new Set(csvRows.map((row) => row.pokemon).filter(Boolean).map(canonicalSpeciesId));
for (const forms of Object.values(groupedForms)) {
  if (forms.some((id) => approvedSpeciesIds.has(id))) forms.forEach((id) => approvedSpeciesIds.add(id));
}

const formFamilyBySpecies = new Map();
for (const [family, forms] of Object.entries(groupedForms)) {
  for (const id of forms) formFamilyBySpecies.set(id, family);
}

export const pokemonCatalog = [...approvedSpeciesIds].map((id) => {
  const species = Dex.species.get(id);
  if (!species.exists) throw new Error(`Approved Pokémon resolved to unknown Showdown ID: ${id}`);
  const familyId = formFamilyBySpecies.get(id) || id;
  const familySize = groupedForms[familyId]?.length || 1;
  return Object.freeze({
    id: species.id,
    name: species.name.replaceAll("-", " "),
    showdownName: species.name,
    spriteId: species.spriteid,
    types: [...species.types],
    ordinaryAbilities: [...new Set([species.abilities["0"], species.abilities["1"]].filter(Boolean))],
    hiddenAbility: species.abilities.H && !(["darmanitan", "darmanitangalar"].includes(id) && species.abilities.H === "Zen Mode") ? species.abilities.H : null,
    gender: species.gender,
    genderRatio: species.genderRatio,
    baseStats: { ...species.baseStats },
    encounterFamilyId: familyId,
    encounterWeight: 1 / familySize,
    starterEligible: starterIds.has(id),
  });
}).sort((left, right) => left.name.localeCompare(right.name));

export const pokemonById = new Map(pokemonCatalog.map((pokemon) => [pokemon.id, pokemon]));
for (const id of ["rotomheat", "rotomwash", "rotomfrost", "rotomfan", "rotommow"]) {
  const species = Dex.species.get(id);
  pokemonById.set(id, Object.freeze({
    id: species.id,
    name: species.name.replaceAll("-", " "),
    showdownName: species.name,
    spriteId: species.spriteid,
    types: [...species.types],
    ordinaryAbilities: [...new Set([species.abilities["0"], species.abilities["1"]].filter(Boolean))],
    hiddenAbility: species.abilities.H || null,
    gender: species.gender,
    genderRatio: species.genderRatio,
    baseStats: { ...species.baseStats },
    encounterFamilyId: "rotom",
    encounterWeight: 0,
    starterEligible: false,
  }));
}
export const encounterPokemon = pokemonCatalog.filter((pokemon) => !pokemon.starterEligible);
export const starterPokemon = pokemonCatalog.filter((pokemon) => pokemon.starterEligible);

const heldConsumables = new Set([
  "absorbbulb", "adrenalineorb", "airballoon", "blunderpolicy", "boosterenergy",
  "ejectbutton", "ejectpack", "electricseed", "focusash", "grassyseed", "luminousmoss",
  "mentalherb", "mirrorherb", "mistyseed", "powerherb", "psychicseed", "roomservice",
  "snowball", "throatspray", "weaknesspolicy",
]);

const premiumHeld = new Set([
  "assaultvest", "choiceband", "choicescarf", "choicespecs", "heavydutyboots", "leftovers",
  "lifeorb", "loadeddice", "rockyhelmet", "focussash", "boosterenergy", "covertcloak",
]);
const strongHeld = new Set([
  "ejectbutton", "ejectpack", "expertbelt", "flameorb", "lightclay", "mentalherb",
  "mirrorherb", "powerherb", "protectivepads", "safetygoggles", "scopelens", "shedshell",
  "throatspray", "toxicorb", "weaknesspolicy", "wideLens", "wiseglasses",
].map(toID));

function heldPrice(item) {
  if (premiumHeld.has(item.id)) return 1200;
  if (strongHeld.has(item.id)) return 800;
  if (item.isBerry) return ["sitrusberry", "lumberry", "custapberry"].includes(item.id) ? 350 : 180;
  if (item.id.endsWith("memory")) return 250;
  if (["charcoal", "blackbelt", "blackglasses", "dragonfang", "fairyfeather", "hardstone", "magnet", "metalcoat", "miracleseed", "mysticwater", "nevermeltice", "poisonbarb", "sharpbeak", "silkscarf", "silverpowder", "softsand", "spelltag", "twistedspoon"].includes(item.id)) return 300;
  return heldConsumables.has(item.id) ? 450 : 550;
}

const trainingDefinitions = Object.freeze({
  hpup: { detail: "+1 HP EV", price: 10, effect: "ev", stat: "hp", amount: 1, icon: "HP" },
  protein: { detail: "+1 Attack EV", price: 10, effect: "ev", stat: "atk", amount: 1, icon: "ATK" },
  iron: { detail: "+1 Defense EV", price: 10, effect: "ev", stat: "def", amount: 1, icon: "DEF" },
  calcium: { detail: "+1 Sp. Atk EV", price: 10, effect: "ev", stat: "spa", amount: 1, icon: "SPA" },
  zinc: { detail: "+1 Sp. Def EV", price: 10, effect: "ev", stat: "spd", amount: 1, icon: "SPD" },
  carbos: { detail: "+1 Speed EV", price: 10, effect: "ev", stat: "spe", amount: 1, icon: "SPE" },
  pomegberry: { detail: "−1 HP EV", price: 8, effect: "ev", stat: "hp", amount: -1, icon: "HP−" },
  kelpsyberry: { detail: "−1 Attack EV", price: 8, effect: "ev", stat: "atk", amount: -1, icon: "ATK−" },
  qualotberry: { detail: "−1 Defense EV", price: 8, effect: "ev", stat: "def", amount: -1, icon: "DEF−" },
  hondewberry: { detail: "−1 Sp. Atk EV", price: 8, effect: "ev", stat: "spa", amount: -1, icon: "SPA−" },
  grepaberry: { detail: "−1 Sp. Def EV", price: 8, effect: "ev", stat: "spd", amount: -1, icon: "SPD−" },
  tamatoberry: { detail: "−1 Speed EV", price: 8, effect: "ev", stat: "spe", amount: -1, icon: "SPE−" },
  bottlecap: { detail: "Set one IV from 0–31", price: 750, effect: "iv", icon: "IV" },
  naturemint: { detail: "Choose any nature", price: 400, effect: "nature", icon: "N" },
  rotomcatalog: { detail: "Change Rotom's form", price: 1200, effect: "rotom", icon: "R" },
  abilitycapsule: { detail: "Change to an ordinary ability", price: 600, effect: "ability-capsule", icon: "AC" },
  abilitypatch: { detail: "Change to the hidden ability", price: 1400, effect: "ability-patch", icon: "AP" },
  rednectar: { detail: "Change Oricorio to Baile Style", price: 300, effect: "form", target: "oricorio", icon: "R" },
  yellownectar: { detail: "Change Oricorio to Pom-Pom Style", price: 300, effect: "form", target: "oricoriopompom", icon: "Y" },
  pinknectar: { detail: "Change Oricorio to Pa'u Style", price: 300, effect: "form", target: "oricoriopau", icon: "P" },
  purplenectar: { detail: "Change Oricorio to Sensu Style", price: 300, effect: "form", target: "oricoriosensu", icon: "P" },
  combatcud: { detail: "Change Paldean Tauros to Combat Breed", price: 500, effect: "form", target: "taurospaldeacombat", icon: "C" },
  blazecud: { detail: "Change Paldean Tauros to Blaze Breed", price: 500, effect: "form", target: "taurospaldeablaze", icon: "B" },
  aquacud: { detail: "Change Paldean Tauros to Aqua Breed", price: 500, effect: "form", target: "taurospaldeaaqua", icon: "A" },
});

const approvedHeldNames = csvRows.map((row) => row["held items"]).filter(Boolean);
const approvedTrainingNames = csvRows.map((row) => row["training items"]).filter(Boolean);

export const itemCatalog = [
  ...approvedHeldNames.map((approvedName) => {
    const item = Dex.items.get(approvedName);
    if (!item.exists) throw new Error(`Unknown approved held item: ${approvedName}`);
    const consumable = Boolean(item.isBerry || heldConsumables.has(item.id));
    return Object.freeze({
      id: item.id,
      name: item.name,
      group: "Held Items",
      detail: item.shortDesc || item.desc || "Held item",
      price: heldPrice(item),
      consumable,
      purchaseLimit: consumable ? null : 1,
      icon: item.name.split(/\s+/).map((word) => word[0]).join("").slice(0, 3).toUpperCase(),
    });
  }),
  ...approvedTrainingNames.map((approvedName) => {
    const id = toID(approvedName);
    const definition = trainingDefinitions[id];
    if (!definition) throw new Error(`Missing training-item behavior for ${approvedName}`);
    return Object.freeze({ id, name: approvedName, group: "Training Items", consumable: true, purchaseLimit: null, ...definition });
  }),
].sort((left, right) => left.group.localeCompare(right.group) || left.name.localeCompare(right.name));

export const itemById = new Map(itemCatalog.map((item) => [item.id, item]));

export const natureNames = Object.freeze(Dex.natures.all().map((nature) => nature.name).sort());

export function contentSummary() {
  return {
    pokemon: pokemonCatalog.length,
    starters: starterPokemon.length,
    heldItems: itemCatalog.filter((item) => item.group === "Held Items").length,
    trainingItems: itemCatalog.filter((item) => item.group === "Training Items").length,
  };
}
