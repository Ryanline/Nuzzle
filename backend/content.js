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
approvedSpeciesIds.delete("smeargle");
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
  if (premiumHeld.has(item.id)) return 2500;
  if (strongHeld.has(item.id)) return 1800;
  if (item.isBerry) return ["sitrusberry", "lumberry", "custapberry"].includes(item.id) ? 1000 : 600;
  if (item.id.endsWith("memory")) return 750;
  if (["charcoal", "blackbelt", "blackglasses", "dragonfang", "fairyfeather", "hardstone", "magnet", "metalcoat", "miracleseed", "mysticwater", "nevermeltice", "poisonbarb", "sharpbeak", "silkscarf", "silverpowder", "softsand", "spelltag", "twistedspoon"].includes(item.id)) return 750;
  return heldConsumables.has(item.id) ? 1200 : 1400;
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
  bottlecap: { detail: "Set one IV from 0–31", price: 900, effect: "iv", icon: "IV" },
  naturemint: { detail: "Choose any nature", price: 1500, effect: "nature", icon: "N" },
  rotomcatalog: { detail: "Change Rotom's form", price: 2000, effect: "rotom", icon: "R" },
  abilitycapsule: { detail: "Change to an ordinary ability", price: 2000, effect: "ability-capsule", icon: "AC" },
  abilitypatch: { detail: "Change to the hidden ability", price: 3000, effect: "ability-patch", icon: "AP" },
  rednectar: { detail: "Change Oricorio to Baile Style", price: 750, effect: "form", target: "oricorio", icon: "R" },
  yellownectar: { detail: "Change Oricorio to Pom-Pom Style", price: 750, effect: "form", target: "oricoriopompom", icon: "Y" },
  pinknectar: { detail: "Change Oricorio to Pa'u Style", price: 750, effect: "form", target: "oricoriopau", icon: "P" },
  purplenectar: { detail: "Change Oricorio to Sensu Style", price: 750, effect: "form", target: "oricoriosensu", icon: "P" },
  combatcud: { detail: "Change Paldean Tauros to Combat Breed", price: 1000, effect: "form", target: "taurospaldeacombat", icon: "C" },
  blazecud: { detail: "Change Paldean Tauros to Blaze Breed", price: 1000, effect: "form", target: "taurospaldeablaze", icon: "B" },
  aquacud: { detail: "Change Paldean Tauros to Aqua Breed", price: 1000, effect: "form", target: "taurospaldeaaqua", icon: "A" },
});

const excludedTmMoves = new Set([
  "agility", "amnesia", "batonpass", "bellydrum", "bulkup", "calmmind", "clangoroussoul",
  "coil", "cosmicpower", "cottonguard", "curse", "doubleteam", "dragondance",
  "filletaway", "geomancy", "growth", "honeclaws", "howl", "irondefense", "minimize",
  "nastyplot", "noretreat", "quiverdance", "revivalblessing", "rockpolish", "shedtail",
  "shellsmash", "shiftgear", "spore", "swordsdance", "tailglow", "tidyup", "victorydance",
  "workup",
]);
const recoveryMoves = new Set([
  "healorder", "milkdrink", "recover", "roost", "shoreup", "slackoff", "softboiled", "strengthsap",
]);
const weatherHealingMoves = new Set(["moonlight", "morningsun", "synthesis"]);
const protectionMoves = new Set([
  "banefulbunker", "burningbulwark", "detect", "kingsshield", "matblock", "obstruct", "protect",
  "silktrap", "spikyshield",
]);
const weatherAndTerrainMoves = new Set([
  "electricterrain", "grassyterrain", "hail", "mistyterrain", "psychicterrain", "raindance",
  "sandstorm", "snowscape", "sunnyday",
]);
const premiumStatusMoves = new Map(Object.entries({
  auroraveil: 1500,
  lightscreen: 1350,
  reflect: 1350,
  substitute: 1500,
  wish: 1500,
}));
const strongStatusMoves = new Set([
  "encore", "haze", "leechseed", "partingshot", "stealthrock", "taunt", "thunderwave",
  "toxic", "toxicspikes", "trick", "willowisp",
]);
const conditionalStatusMoves = new Set([
  "destinybond", "disable", "glare", "hypnosis", "magiccoat", "sleeppowder", "stickyweb",
  "tailwind", "trickroom", "whirlwind",
]);
const lowValueStatusMoves = new Set([
  "babydolleyes", "charm", "confide", "defensecurl", "flash", "growl", "harden", "leer",
  "nobleroar", "playnice", "sandattack", "scaryface", "smokescreen", "stringshot", "supersonic",
  "sweetscent", "tailwhip", "tickle", "withdraw",
]);
const majorStatuses = new Set(["brn", "frz", "par", "psn", "slp", "tox"]);
const utilityAttackAdjustments = new Map(Object.entries({
  flipturn: 300,
  knockoff: 300,
  rapidspin: 300,
  uturn: 300,
  voltswitch: 300,
}));
const rechargeMoves = new Set(["blastburn", "eternabeam", "frenzyplant", "gigaimpact", "hydrocannon", "hyperbeam", "meteorassault", "prismaticlaser", "roaroftime", "rockwrecker"]);
const twoTurnMoves = new Set(["bounce", "dig", "dive", "electroshot", "fly", "freezeshock", "geomancy", "iceburn", "meteorbeam", "phantomforce", "razorwind", "shadowforce", "skullbash", "skyattack", "solarblade", "solarbeam"]);
const fixedTmPrices = new Map(Object.entries({
  aurawheel: 1800,
  dreameater: 1100,
  focuspunch: 1800,
  lastresort: 1800,
  populationbomb: 2400,
  rapidspin: 1300,
}));

function roundTmPrice(value, minimum = 100) {
  return Math.max(minimum, Math.ceil(value / 50) * 50);
}

function secondaryValue(secondary) {
  const chance = Number(secondary?.chance || 100);
  if (majorStatuses.has(secondary?.status)) return chance * 5;
  if (secondary?.volatileStatus === "flinch" || secondary?.volatileStatus === "confusion") return chance * 2.5;
  const drops = Object.values(secondary?.boosts || {}).filter((amount) => amount < 0);
  if (drops.length) return chance * (Math.max(...drops.map(Math.abs)) >= 2 ? 2 : 1);
  return 0;
}

function selfBoostValue(move, secondaries) {
  let value = Object.values(move.self?.boosts || {}).some((amount) => amount > 0) ? 1000 : 0;
  for (const secondary of secondaries) {
    if (Object.values(secondary?.self?.boosts || {}).some((amount) => amount > 0)) value += Number(secondary.chance || 100) * 10;
  }
  return value;
}

function effectiveBasePower(move) {
  if (!move.multihit) return move.basePower;
  const hits = Array.isArray(move.multihit) ? (move.multihit[0] + move.multihit[1]) / 2 : move.multihit;
  return move.basePower * hits;
}

function tmPrice(move) {
  if (fixedTmPrices.has(move.id)) return fixedTmPrices.get(move.id);
  if (move.category === "Status") {
    if (move.id === "splash") return 100;
    if (lowValueStatusMoves.has(move.id)) return 250;
    if (protectionMoves.has(move.id) || move.id === "perishsong") return 2000;
    if (weatherHealingMoves.has(move.id)) return 1750;
    if (weatherAndTerrainMoves.has(move.id)) return 1200;
    if (recoveryMoves.has(move.id)) return 2000;
    if (premiumStatusMoves.has(move.id)) return premiumStatusMoves.get(move.id);
    if (strongStatusMoves.has(move.id)) return 1000;
    if (conditionalStatusMoves.has(move.id)) return 750;
    return 500;
  }

  if (["electroball", "gyroball"].includes(move.id)) return 1000;

  const accuracy = move.accuracy === true ? 100 : Number(move.accuracy || 100);
  const secondaries = move.secondaries || (move.secondary ? [move.secondary] : []);
  const effects = Math.min(900, secondaries.reduce((sum, secondary) => sum + secondaryValue(secondary), 0));
  let value = effectiveBasePower(move) * 16 + effects + selfBoostValue(move, secondaries) - Math.max(0, 100 - accuracy) * 10;
  if (move.accuracy === true) value += 100;
  if (move.priority > 0) value += 500;
  if (move.drain) value += (move.drain[0] / move.drain[1]) * 100 * 10;
  if (move.recoil) value -= 250;
  if (rechargeMoves.has(move.id)) value -= 500;
  if (twoTurnMoves.has(move.id)) value -= 300;
  const selfDrops = Object.values(move.self?.boosts || {}).filter((amount) => amount < 0);
  if (selfDrops.length) value -= Math.max(...selfDrops.map(Math.abs)) >= 2 ? 400 : 200;
  value += utilityAttackAdjustments.get(move.id) || 0;
  return roundTmPrice(value, 500);
}

function excludedTm(move) {
  if (excludedTmMoves.has(move.id)) return true;
  if (move.category !== "Status") return false;
  return [move.boosts, move.self?.boosts].some((boosts) => Object.values(boosts || {}).some((amount) => amount > 0));
}

const learnableMoveIdsBySpecies = new Map();
export function learnableMoveIds(speciesId) {
  if (!learnableMoveIdsBySpecies.has(speciesId)) {
    let ids = [];
    try {
      const directlyLearned = new Set(Dex.species.getFullLearnset(speciesId).flatMap(({ learnset }) => Object.keys(learnset)));
      ids = [...directlyLearned].filter((id) => {
        const move = Dex.moves.get(id);
        return move.exists && !move.isMax && !move.isZ && move.id !== "struggle" && !excludedTm(move);
      });
    } catch {}
    learnableMoveIdsBySpecies.set(speciesId, Object.freeze([...new Set(ids)]));
  }
  return learnableMoveIdsBySpecies.get(speciesId);
}

const approvedMoveIds = new Set(pokemonCatalog.flatMap((pokemon) => learnableMoveIds(pokemon.id)));
const tmCatalog = [...approvedMoveIds].map((id) => {
  const move = Dex.moves.get(id);
  const accuracy = move.accuracy === true ? "—" : `${move.accuracy}%`;
  const power = move.category === "Status" ? "—" : move.basePower || "—";
  return Object.freeze({
    id: `tm-${move.id}`,
    name: move.name,
    group: "TMs",
    detail: `${move.type} · ${move.category} · Power ${power} · Accuracy ${accuracy}`,
    description: move.shortDesc || move.desc || "Teaches this move to an eligible Pokémon.",
    price: tmPrice(move),
    effect: "tm",
    moveId: move.id,
    move: move.name,
    type: move.type,
    category: move.category,
    power: move.basePower,
    accuracy: move.accuracy,
    consumable: true,
    purchaseLimit: null,
    icon: "TM",
  });
});

const approvedHeldNames = csvRows.map((row) => row["held items"]).filter(Boolean);
const approvedTrainingNames = csvRows.map((row) => row["training items"]).filter(Boolean);

export const itemCatalog = [
  ...approvedHeldNames.map((approvedName) => {
    const item = Dex.items.get(approvedName);
    if (!item.exists) throw new Error(`Unknown approved held item: ${approvedName}`);
    return Object.freeze({
      id: item.id,
      name: item.name,
      group: "Held Items",
      detail: item.shortDesc || item.desc || "Held item",
      price: heldPrice(item),
      consumable: false,
      battleConsumable: Boolean(item.isBerry || heldConsumables.has(item.id)),
      purchaseLimit: 1,
      icon: item.name.split(/\s+/).map((word) => word[0]).join("").slice(0, 3).toUpperCase(),
    });
  }),
  ...approvedTrainingNames.map((approvedName) => {
    const id = toID(approvedName);
    const definition = trainingDefinitions[id];
    if (!definition) throw new Error(`Missing training-item behavior for ${approvedName}`);
    return Object.freeze({ id, name: approvedName, group: "Training Items", consumable: true, purchaseLimit: null, ...definition });
  }),
  ...tmCatalog,
].sort((left, right) => left.group.localeCompare(right.group) || left.name.localeCompare(right.name));

export const itemById = new Map(itemCatalog.map((item) => [item.id, item]));

export const natureNames = Object.freeze(Dex.natures.all().map((nature) => nature.name).sort());

export function contentSummary() {
  return {
    pokemon: pokemonCatalog.length,
    starters: starterPokemon.length,
    heldItems: itemCatalog.filter((item) => item.group === "Held Items").length,
    trainingItems: itemCatalog.filter((item) => item.group === "Training Items").length,
    tms: itemCatalog.filter((item) => item.group === "TMs").length,
  };
}
