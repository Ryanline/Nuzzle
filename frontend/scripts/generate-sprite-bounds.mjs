import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const showdownDirectory = path.resolve(scriptDirectory, "..", "assets", "showdown");
const spriteDirectories = ["gen5-back", "gen5-back-shiny"];
const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function paeth(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  return leftDistance <= aboveDistance && leftDistance <= upperLeftDistance ? left : aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function decodePng(bytes) {
  if (!bytes.subarray(0, signature.length).equals(signature)) throw new Error("Not a PNG");
  let offset = signature.length;
  let header;
  let transparency;
  const imageChunks = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") header = {
      width: data.readUInt32BE(0),
      height: data.readUInt32BE(4),
      bitDepth: data[8],
      colorType: data[9],
      interlace: data[12],
    };
    else if (type === "tRNS") transparency = data;
    else if (type === "IDAT") imageChunks.push(data);
    else if (type === "IEND") break;
    offset += length + 12;
  }
  if (!header || header.interlace !== 0) throw new Error("Unsupported PNG layout");
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[header.colorType];
  if (!channels || ![4, 8].includes(header.bitDepth)) throw new Error("Unsupported PNG color format");
  const rowBytes = Math.ceil(header.width * channels * header.bitDepth / 8);
  const filterStride = Math.max(1, Math.ceil(channels * header.bitDepth / 8));
  const inflated = inflateSync(Buffer.concat(imageChunks));
  const rows = [];
  let sourceOffset = 0;
  for (let y = 0; y < header.height; y++) {
    const filter = inflated[sourceOffset++];
    const source = inflated.subarray(sourceOffset, sourceOffset + rowBytes);
    const row = Buffer.allocUnsafe(rowBytes);
    const previous = rows[y - 1];
    for (let index = 0; index < rowBytes; index++) {
      const value = source[index];
      const left = index >= filterStride ? row[index - filterStride] : 0;
      const above = previous?.[index] || 0;
      const upperLeft = index >= filterStride ? previous?.[index - filterStride] || 0 : 0;
      row[index] = (value + (filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? above : filter === 3 ? Math.floor((left + above) / 2) : paeth(left, above, upperLeft))) & 0xff;
    }
    rows.push(row);
    sourceOffset += rowBytes;
  }
  return { ...header, transparency, rows };
}

function pixelIsVisible(png, x, y) {
  const row = png.rows[y];
  if (png.colorType === 6) return row[x * 4 + 3] > 0;
  if (png.colorType === 4) return row[x * 2 + 1] > 0;
  if (png.colorType === 3) {
    const index = png.bitDepth === 8 ? row[x] : (row[Math.floor(x / 2)] >> (x % 2 ? 0 : 4)) & 0x0f;
    return (png.transparency?.[index] ?? 255) > 0;
  }
  if (png.colorType === 0 && png.transparency) return row[x] !== png.transparency.readUInt16BE(0);
  if (png.colorType === 2 && png.transparency) {
    const offset = x * 3;
    return row[offset] !== png.transparency.readUInt16BE(0) || row[offset + 1] !== png.transparency.readUInt16BE(2) || row[offset + 2] !== png.transparency.readUInt16BE(4);
  }
  return true;
}

function visibleBounds(bytes) {
  const png = decodePng(bytes);
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      if (!pixelIsVisible(png, x, y)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return maxX < 0
    ? [0, 0, png.width, png.height, png.width, png.height]
    : [minX, minY, maxX - minX + 1, maxY - minY + 1, png.width, png.height];
}

export async function generateSpriteBounds() {
  const bounds = {};
  for (const directory of spriteDirectories) {
    const filenames = (await readdir(path.join(showdownDirectory, directory))).filter((filename) => filename.endsWith(".png")).sort();
    for (const filename of filenames) {
      const relative = `${directory}/${filename}`;
      bounds[relative] = visibleBounds(await readFile(path.join(showdownDirectory, directory, filename)));
    }
  }
  await writeFile(path.join(showdownDirectory, "sprite-bounds.json"), `${JSON.stringify(bounds)}\n`);
  console.log(`Generated visible bounds for ${Object.keys(bounds).length} back sprites.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await generateSpriteBounds();
