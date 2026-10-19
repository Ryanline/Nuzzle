import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BattleService } from "./battle-service.js";
import { BattleStore } from "./battle-store.js";
import { publicRoster } from "./teams.js";

const backendDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.dirname(backendDirectory);
const frontendDirectory = path.join(projectDirectory, "frontend");
const dataDirectory = process.env.NUZZLE_DATA_DIR || path.join(backendDirectory, "data", "battles");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";

const service = new BattleService(new BattleStore(dataDirectory));
await service.initialize();

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function json(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function requestBody(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 64 * 1024) throw Object.assign(new Error("Request body is too large."), { statusCode: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON."), { statusCode: 400 });
  }
}

async function api(request, response, pathname) {
  if (request.method === "GET" && pathname === "/api/health") {
    json(response, 200, { ok: true, engine: "pokemon-showdown", format: "gen9customgame" });
    return true;
  }
  if (request.method === "GET" && pathname === "/api/roster") {
    json(response, 200, { roster: publicRoster() });
    return true;
  }
  if (request.method === "POST" && pathname === "/api/battles") {
    json(response, 201, await service.create(await requestBody(request)));
    return true;
  }
  const match = pathname.match(/^\/api\/battles\/([0-9a-f-]+)(?:\/(choices|forfeit))?$/i);
  if (!match) return false;
  const battle = service.get(match[1]);
  if (request.method === "GET" && !match[2]) {
    json(response, 200, battle.state());
    return true;
  }
  if (request.method === "POST" && match[2] === "choices") {
    const body = await requestBody(request);
    json(response, 200, await battle.choose(body.action || {}, body.rqid));
    return true;
  }
  if (request.method === "POST" && match[2] === "forfeit") {
    json(response, 200, await battle.forfeit());
    return true;
  }
  throw Object.assign(new Error("Method not allowed."), { statusCode: 405 });
}

async function staticFile(response, pathname) {
  const relative = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
  const filename = path.resolve(frontendDirectory, relative);
  if (filename !== frontendDirectory && !filename.startsWith(`${frontendDirectory}${path.sep}`)) {
    throw Object.assign(new Error("Not found."), { statusCode: 404 });
  }
  const metadata = await stat(filename).catch(() => null);
  if (!metadata?.isFile()) throw Object.assign(new Error("Not found."), { statusCode: 404 });
  response.writeHead(200, {
    "Content-Type": contentTypes[path.extname(filename)] || "application/octet-stream",
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(await readFile(filename));
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      if (!await api(request, response, url.pathname)) json(response, 404, { error: "API route not found." });
      return;
    }
    await staticFile(response, url.pathname);
  } catch (error) {
    const statusCode = Number(error.statusCode) || (error.code === "ENOENT" ? 404 : 500);
    if (statusCode >= 500) console.error(error);
    json(response, statusCode, { error: error.message || "Request failed." });
  }
});

server.listen(port, host, () => {
  console.log(`Nuzzle is running at http://${host}:${port}`);
});

export { server };
