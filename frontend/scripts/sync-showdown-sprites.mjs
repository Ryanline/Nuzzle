import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { trainerSpriteIds } from "../../backend/trainer-sprite-ids.js";
import { generateSpriteBounds } from "./generate-sprite-bounds.mjs";

const require = createRequire(import.meta.url);
const { Dex } = require("pokemon-showdown");
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const assetsDirectory = path.resolve(scriptDirectory, "..", "assets", "showdown");
const origin = "https://play.pokemonshowdown.com/sprites";
const concurrency = 3;
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const pokemonSpriteIds = [...new Set(Dex.species.all()
  .filter((species) => species.exists && species.spriteid)
  .map((species) => species.spriteid))].sort();
const typeNames = Dex.types.all().filter((type) => type.exists).map((type) => type.name).sort();

const allAssets = [
  { directory: "", filename: "itemicons-sheet.png" },
  ...typeNames.map((name) => ({ directory: "types", filename: `${name}.png` })),
  ...["Physical", "Special", "Status"].map((name) => ({ directory: "categories", filename: `${name}.png` })),
  ...trainerSpriteIds.map((id) => ({ directory: "trainers", filename: `${id}.png` })),
  ...["gen5", "gen5-back", "gen5-shiny", "gen5-back-shiny"].flatMap((directory) => pokemonSpriteIds.map((id) => ({ directory, filename: `${id}.png` }))),
];
const requestedAssets = process.argv.slice(2);
const assets = requestedAssets.length
  ? allAssets.filter((asset) => requestedAssets.includes(path.posix.join(asset.directory, asset.filename)))
  : allAssets;
if (assets.length !== requestedAssets.length && requestedAssets.length) {
  throw new Error("Every requested asset must be an exact path from the Showdown sprite catalog.");
}

function isPng(bytes) {
  return bytes.length >= pngSignature.length && bytes.subarray(0, pngSignature.length).equals(pngSignature);
}

async function existingPng(filename) {
  try {
    return isPng(await readFile(filename));
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function download(asset) {
  const relative = path.posix.join(asset.directory, asset.filename);
  const target = path.join(assetsDirectory, ...relative.split("/"));
  if (await existingPng(target)) return "existing";

  const url = `${origin}/${relative.split("/").map(encodeURIComponent).join("/")}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { headers: { Connection: "close" }, signal: AbortSignal.timeout(10_000) });
      if (response.status === 404) return "missing";
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!isPng(bytes)) throw new Error("response was not a PNG");
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes);
      return "downloaded";
    } catch (error) {
      if (attempt === 3) return { status: "failed", detail: `${relative}: ${error.message}` };
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
}

const totals = { downloaded: 0, existing: 0, missing: 0, failed: 0 };
const unavailable = [];
let cursor = 0;
async function worker() {
  while (cursor < assets.length) {
    const asset = assets[cursor++];
    const result = await download(asset);
    const status = typeof result === "string" ? result : result.status;
    if (status !== "existing") await new Promise((resolve) => setTimeout(resolve, 500));
    totals[status]++;
    if (status === "missing" || status === "failed") unavailable.push({
      path: path.posix.join(asset.directory, asset.filename),
      reason: status === "missing" ? "not-found" : result.detail,
    });
    const complete = Object.values(totals).reduce((sum, count) => sum + count, 0);
    if (complete % 250 === 0 || complete === assets.length) {
      console.log(`${complete}/${assets.length}: ${totals.downloaded} downloaded, ${totals.existing} existing, ${totals.missing} unavailable`);
    }
  }
}

await mkdir(assetsDirectory, { recursive: true });
await Promise.all(Array.from({ length: concurrency }, worker));
await writeFile(path.join(assetsDirectory, "manifest.json"), `${JSON.stringify({ totals, unavailable }, null, 2)}\n`);
await generateSpriteBounds();
console.log(`Showdown sprite sync complete: ${JSON.stringify(totals)}`);
if (totals.failed) process.exitCode = 1;
