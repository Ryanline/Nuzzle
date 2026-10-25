import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BattleService } from "./battle-service.js";
import { BattleStore } from "./battle-store.js";
import { AuthStore, SESSION_LIFETIME_MS } from "./auth-store.js";
import { GameStore, publicContent } from "./game-store.js";
import { trainerSprites, TrainerStore } from "./trainer-store.js";

const backendDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.dirname(backendDirectory);
const frontendDirectory = path.join(projectDirectory, "frontend");
const dataDirectory = process.env.NUZZLE_DATA_DIR || path.join(backendDirectory, "data");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";

const auth = new AuthStore(path.join(dataDirectory, "auth.json"));
const game = new GameStore(path.join(dataDirectory, "game.json"));
const trainers = new TrainerStore(path.join(dataDirectory, "trainers.json"));
const service = new BattleService(new BattleStore(path.join(dataDirectory, "battles")), {
  settle: async (record) => {
    if (!record.userId) return;
    if (record.result?.playerWiped) {
      await game.resetAfterWipe(record.userId, record.id);
      return;
    }
    await game.settleBattle(record.userId, record.id, {
      acquisitions: record.itemAcquisitions,
      faintedPokemonIds: record.result?.faintedPokemonIds,
      won: record.result?.winner === "Player",
    });
  },
});
await auth.initialize();
await game.initialize();
await trainers.initialize();
await service.initialize();

const loginAttempts = new Map();
const sessionCookie = "nuzzle_session";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function json(response, statusCode, body, extraHeaders = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  response.end(JSON.stringify(body));
}

function cookies(request) {
  return Object.fromEntries(String(request.headers.cookie || "").split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const separator = part.indexOf("=");
    return separator < 0 ? [part, ""] : [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
  }));
}

function sessionToken(request) {
  return cookies(request)[sessionCookie] || "";
}

function sessionHeader(token, maxAge = Math.floor(SESSION_LIFETIME_MS / 1000)) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${sessionCookie}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function requireUser(request) {
  const user = auth.userForToken(sessionToken(request));
  if (!user) throw Object.assign(new Error("Please log in to continue."), { statusCode: 401 });
  return user;
}

function requireAdmin(request) {
  const user = requireUser(request);
  if (!user.isAdmin) throw Object.assign(new Error("Administrator access is required."), { statusCode: 403 });
  return user;
}

function clientAddress(request) {
  const directAddress = request.socket.remoteAddress || "unknown";
  const localProxy = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(directAddress);
  if (!localProxy) return directAddress;
  return String(request.headers["x-forwarded-for"] || "").split(",")[0].trim() || directAddress;
}

function rateLimitLogin(request) {
  const key = clientAddress(request);
  const now = Date.now();
  const recent = (loginAttempts.get(key) || []).filter((timestamp) => now - timestamp < 10 * 60 * 1000);
  if (recent.length >= 20) throw Object.assign(new Error("Too many login attempts. Please wait and try again."), { statusCode: 429 });
  recent.push(now);
  loginAttempts.set(key, recent);
}

async function requestBytes(request, maximumLength) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > maximumLength) throw Object.assign(new Error("Request body is too large."), { statusCode: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function requestBody(request) {
  const bytes = await requestBytes(request, 64 * 1024);
  if (!bytes.length) return {};
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON."), { statusCode: 400 });
  }
}

async function api(request, response, pathname) {
  if (request.method === "GET" && pathname === "/api/health") {
    json(response, 200, { ok: true, engine: "pokemon-showdown", format: "gen9customgame" });
    return true;
  }
  if (request.method === "GET" && pathname === "/api/auth/me") {
    json(response, 200, { user: auth.userForToken(sessionToken(request)) });
    return true;
  }
  if (request.method === "POST" && pathname === "/api/auth/register") {
    rateLimitLogin(request);
    const body = await requestBody(request);
    const result = await auth.register(body.username, body.password);
    json(response, 201, { user: result.user }, { "Set-Cookie": sessionHeader(result.token) });
    return true;
  }
  if (request.method === "POST" && pathname === "/api/auth/login") {
    rateLimitLogin(request);
    const body = await requestBody(request);
    const result = await auth.login(body.username, body.password);
    json(response, 200, { user: result.user }, { "Set-Cookie": sessionHeader(result.token) });
    return true;
  }
  if (request.method === "POST" && pathname === "/api/auth/logout") {
    await auth.logout(sessionToken(request));
    json(response, 200, { ok: true }, { "Set-Cookie": sessionHeader("", 0) });
    return true;
  }
  if (request.method === "GET" && pathname === "/api/account/avatars") {
    requireUser(request);
    json(response, 200, { sprites: trainerSprites });
    return true;
  }
  if (request.method === "PUT" && pathname === "/api/account/avatar") {
    const user = requireUser(request);
    const body = await requestBody(request);
    json(response, 200, { user: await auth.updateAvatar(user.id, body.spriteId) });
    return true;
  }
  if (request.method === "GET" && pathname === "/api/roster") {
    json(response, 200, { roster: publicContent().pokemon });
    return true;
  }
  if (request.method === "GET" && pathname === "/api/content") {
    json(response, 200, publicContent());
    return true;
  }
  if (request.method === "GET" && pathname === "/api/today") {
    const { opponentTeam, ...today } = await trainers.current();
    json(response, 200, today);
    return true;
  }
  if (request.method === "GET" && pathname === "/api/leaderboard/daily") {
    requireUser(request);
    const today = await trainers.current();
    json(response, 200, {
      date: today.date,
      entries: service.dailyLeaderboard(today.date, (userId) => auth.userById(userId)),
    });
    return true;
  }
  if (request.method === "GET" && pathname === "/api/leaderboard/streak") {
    requireUser(request);
    const today = await trainers.current();
    json(response, 200, {
      date: today.date,
      entries: service.streakLeaderboard(today.date, (userId) => auth.userById(userId)),
    });
    return true;
  }
  if (pathname === "/api/admin/trainers") {
    requireAdmin(request);
    if (request.method === "GET") {
      json(response, 200, await trainers.adminState());
      return true;
    }
    if (request.method === "POST") {
      await trainers.add(await requestBody(request));
      json(response, 201, await trainers.adminState());
      return true;
    }
    throw Object.assign(new Error("Method not allowed."), { statusCode: 405 });
  }
  if (request.method === "PUT" && pathname === "/api/admin/trainers/order") {
    requireAdmin(request);
    const body = await requestBody(request);
    await trainers.reorder(body.ids);
    json(response, 200, await trainers.adminState());
    return true;
  }
  const trainerMatch = pathname.match(/^\/api\/admin\/trainers\/([0-9a-f-]+)$/i);
  if (request.method === "DELETE" && trainerMatch) {
    requireAdmin(request);
    await trainers.remove(trainerMatch[1]);
    json(response, 200, await trainers.adminState());
    return true;
  }
  if (request.method === "GET" && pathname === "/api/game") {
    const user = requireUser(request);
    const state = await game.get(user.id);
    const dailyBattle = service.dailyBattle(user.id, state.date);
    json(response, 200, {
      ...state,
      dailyBattleAttempted: service.hasDailyAttempt(user.id, state.date),
      dailyBattleId: dailyBattle?.record.id || null,
      dailyBattleEnded: Boolean(dailyBattle?.stream.battle?.ended),
    });
    return true;
  }
  if (request.method === "POST" && pathname === "/api/admin/battle/reset") {
    const user = requireAdmin(request);
    const state = await game.get(user.id);
    await service.resetDailyAttempt(user.id, state.date);
    json(response, 200, { date: state.date, reset: true });
    return true;
  }
  const encounterMatch = pathname.match(/^\/api\/game\/encounters\/(\d+)$/);
  if (request.method === "POST" && encounterMatch) {
    const user = requireUser(request);
    json(response, 200, await game.claimEncounter(user.id, Number(encounterMatch[1])));
    return true;
  }
  if (request.method === "PUT" && pathname === "/api/game/team") {
    const user = requireUser(request);
    const body = await requestBody(request);
    json(response, 200, await game.setTeam(user.id, body.teamIds));
    return true;
  }
  const shopMatch = pathname.match(/^\/api\/game\/shop\/([a-z0-9-]+)$/);
  if (request.method === "POST" && shopMatch) {
    const user = requireUser(request);
    const body = await requestBody(request);
    json(response, 200, await game.buy(user.id, shopMatch[1], body.quantity));
    return true;
  }
  const pokemonItemMatch = pathname.match(/^\/api\/game\/pokemon\/([a-z0-9]+)\/(equip|unequip|train)$/);
  if (request.method === "POST" && pokemonItemMatch) {
    const user = requireUser(request);
    const body = await requestBody(request);
    const result = pokemonItemMatch[2] === "equip"
      ? await game.equip(user.id, pokemonItemMatch[1], body.itemId)
      : pokemonItemMatch[2] === "unequip"
        ? await game.unequip(user.id, pokemonItemMatch[1])
        : await game.useTrainingItem(user.id, pokemonItemMatch[1], body.itemId, body.options);
    json(response, 200, result);
    return true;
  }
  const pokemonTrainingMatch = pathname.match(/^\/api\/game\/pokemon\/([a-z0-9]+)\/training\/(quote|apply)$/);
  if (request.method === "POST" && pokemonTrainingMatch) {
    const user = requireUser(request);
    const body = await requestBody(request);
    const result = pokemonTrainingMatch[2] === "quote"
      ? await game.quoteTrainingBuild(user.id, pokemonTrainingMatch[1], body.build)
      : await game.applyTrainingBuild(user.id, pokemonTrainingMatch[1], body.build, body.expectedCost, body.idempotencyKey);
    json(response, 200, result);
    return true;
  }
  if (request.method === "POST" && pathname === "/api/battles") {
    const user = requireUser(request);
    const body = await requestBody(request);
    const playerTeam = await game.battleTeam(user.id, body.partyIds, body.leadId);
    const today = await trainers.current();
    json(response, 201, await service.create({
      ...body,
      playerTeam,
      opponentTeam: today.opponentTeam,
      trainerName: today.trainer.name,
      trainerSpriteId: today.trainer.spriteId,
      challengeDate: today.date,
      challengeNumber: today.number,
    }, user.id));
    return true;
  }
  const match = pathname.match(/^\/api\/battles\/([0-9a-f-]+)(?:\/(choices|forfeit))?$/i);
  if (!match) return false;
  const user = requireUser(request);
  const battle = service.get(match[1], user.id);
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
