import crypto from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Dex } = require("pokemon-showdown");

const guaranteedSignatures = Object.freeze({
  aegislash: ["kingsshield"],
  archaludon: ["electroshot"],
  braviaryhisui: ["esperwing"],
  cacturne: ["needlearm"],
  castform: ["weatherball"],
  crabominable: ["icehammer"],
  decidueye: ["spiritshackle"],
  decidueyehisui: ["triplearrows"],
  dhelmise: ["anchorshot"],
  garganacl: ["saltcure"],
  gourgeist: ["trickortreat"],
  gourgeistlarge: ["trickortreat"],
  gourgeistsmall: ["trickortreat"],
  gourgeistsuper: ["trickortreat"],
  hawlucha: ["flyingpress"],
  incineroar: ["darkestlariat"],
  klinklang: ["geargrind"],
  kleavor: ["stoneaxe"],
  lycanroc: ["accelerock"],
  lycanrocdusk: ["accelerock"],
  malamar: ["topsyturvy"],
  maushold: ["populationbomb"],
  meowscarada: ["flowertrick"],
  morpeko: ["aurawheel"],
  oricorio: ["revelationdance"],
  oricoriopau: ["revelationdance"],
  oricoriopompom: ["revelationdance"],
  oricoriosensu: ["revelationdance"],
  palafin: ["jetpunch"],
  palossand: ["shoreup"],
  pawmot: ["doubleshock"],
  quaquaval: ["aquastep"],
  raticate: ["hyperfang"],
  revavroom: ["spinout"],
  ribombee: ["pollenpuff"],
  sawsbuck: ["hornleech"],
  sceptile: ["leafblade"],
  scizor: ["bulletpunch"],
  silvally: ["multiattack"],
  sinistcha: ["matchagotcha"],
  skeledirge: ["torchsong"],
  slowbrogalar: ["shellsidearm"],
  tauros: ["ragingbull"],
  taurospaldeaaqua: ["ragingbull"],
  taurospaldeablaze: ["ragingbull"],
  taurospaldeacombat: ["ragingbull"],
  tinkaton: ["gigatonhammer"],
  togedemaru: ["zingzap"],
  toucannon: ["beakblast"],
  toxapex: ["banefulbunker"],
  trevenant: ["forestscurse"],
  tsareena: ["tropkick"],
  veluza: ["filletaway"],
  wugtrio: ["tripledive"],
});

const optionalSignaturePool = Object.freeze({
  blaziken: ["blazekick"],
  emboar: ["heatcrash"],
  kingambit: ["kowtowcleave"],
  kingler: ["crabhammer"],
  kommoo: ["clangingscales"],
  marowak: ["bonemerang", "boneclub"],
  marowakalola: ["shadowbone"],
  raichu: ["volttackle"],
  salazzle: ["firelash"],
  samurotthisui: ["ceaselessedge"],
  sneasler: ["direclaw"],
  swampert: ["muddywater"],
  zoroark: ["nightdaze"],
});

const priorityStabExceptions = new Set(["accelerock", "bulletpunch"]);
const bannedRandomMoves = new Set([
  "doubleedge", "explosion", "finalgambit", "gigaimpact", "healingwish", "hyperbeam",
  "lunardance", "memento", "selfdestruct", "splash", "takedown",
]);
const lowValueStatusMoves = new Set([
  "confide", "defensecurl", "flash", "growl", "harden", "leer", "playnice", "sandattack",
  "smokescreen", "stringshot", "sweetscent", "tailwhip", "withdraw",
]);

function directMoveIds(speciesId) {
  return [...new Set(Dex.species.getFullLearnset(speciesId).flatMap(({ learnset }) => Object.keys(learnset)))];
}

function effectivePower(move) {
  if (!move.multihit) return move.basePower;
  const hits = Array.isArray(move.multihit) ? (move.multihit[0] + move.multihit[1]) / 2 : move.multihit;
  return move.basePower * hits;
}

function accuracy(move) {
  return move.accuracy === true ? 100 : Number(move.accuracy || 0);
}

function isDamaging(move) {
  return move.category !== "Status" && effectivePower(move) > 0;
}

function validRandomMove(move) {
  if (!move.exists || move.isMax || move.isZ || bannedRandomMoves.has(move.id)) return false;
  if (move.ohko || move.selfdestruct) return false;
  if (move.category !== "Status" && (!isDamaging(move) || (effectivePower(move) < 60 && !priorityStabExceptions.has(move.id)))) return false;
  if (isDamaging(move) && accuracy(move) < 70) return false;
  return !lowValueStatusMoves.has(move.id);
}

function isStabType(move, type, species) {
  if (move.id === "revelationdance" && species.baseSpecies === "Oricorio") return type !== "Flying";
  return move.type === type;
}

function validStab(move, type, species) {
  if (!validRandomMove(move) || !isDamaging(move) || !isStabType(move, type, species)) return false;
  return effectivePower(move) >= 60 || priorityStabExceptions.has(move.id);
}

function attackingPreference(move, species) {
  if (move.category === "Physical" && species.baseStats.atk * 1.2 < species.baseStats.spa) return 0.65;
  if (move.category === "Special" && species.baseStats.spa * 1.2 < species.baseStats.atk) return 0.65;
  return 1;
}

function stabWeight(move, species) {
  const power = effectivePower(move);
  const powerWeight = power < 75
    ? Math.max(0.35, 1 - (75 - power) / 50)
    : power <= 100
      ? 1
      : Math.max(0.4, 1 - (power - 100) / 80);
  const accuracyWeight = move.accuracy === true ? 1 : accuracy(move) / 100;
  const recoilWeight = move.recoil ? 0.8 : 1;
  return Math.max(0.05, powerWeight * accuracyWeight * recoilWeight * attackingPreference(move, species));
}

function plainWeight(move, species) {
  if (move.category === "Status") return 0.7;
  return Math.max(0.15, stabWeight(move, species) * (species.types.includes(move.type) ? 0.9 : 0.75));
}

function weightedChoice(entries, weight) {
  const total = entries.reduce((sum, entry) => sum + weight(entry), 0);
  let roll = (crypto.randomInt(0x1000000) / 0x1000000) * total;
  for (const entry of entries) {
    roll -= weight(entry);
    if (roll <= 0) return entry;
  }
  return entries.at(-1);
}

function signatureIds(speciesId, table) {
  return table[speciesId] || [];
}

export function generateEncounterMoves(speciesId) {
  const species = Dex.species.get(speciesId);
  const legalIds = new Set(directMoveIds(speciesId));
  const legalMoves = [...legalIds].map((id) => Dex.moves.get(id));
  const pool = legalMoves.filter(validRandomMove);
  const selected = [];

  for (const type of species.types) {
    const candidates = pool.filter((move) => validStab(move, type, species) && !selected.includes(move.id));
    const fallback = legalMoves.filter((move) => move.exists && !move.isMax && !move.isZ && !bannedRandomMoves.has(move.id) && isDamaging(move) && isStabType(move, type, species) && accuracy(move) >= 70 && !selected.includes(move.id));
    const choicePool = candidates.length ? candidates : fallback;
    if (choicePool.length) selected.push(weightedChoice(choicePool, (move) => stabWeight(move, species)).id);
  }

  for (const id of signatureIds(speciesId, guaranteedSignatures)) {
    if (!selected.includes(id) && legalIds.has(id) && selected.length < 4) selected.push(id);
  }

  const optionalIds = new Set(signatureIds(speciesId, optionalSignaturePool));
  while (selected.length < 4) {
    const candidates = pool.filter((move) => !selected.includes(move.id));
    if (!candidates.length) break;
    selected.push(weightedChoice(candidates, (move) => plainWeight(move, species) * (optionalIds.has(move.id) ? 1.15 : 1)).id);
  }

  while (selected.length < 4) selected.push(selected.at(-1) || "tackle");
  return selected.slice(0, 4).map((id) => Dex.moves.get(id).name);
}

export const encounterSignatureMoves = guaranteedSignatures;
export const encounterOptionalSignatureMoves = optionalSignaturePool;
