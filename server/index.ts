import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import staticFiles from "@fastify/static";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { getConfig } from "./config.js";
import { createPool } from "./db/pool.js";
import { runFixtureBattle } from "./showdown/fixture-battle.js";
import { InteractiveBattleStore } from "./showdown/interactive-battle.js";

const config = getConfig();
const app = Fastify({ logger: true });
const database = createPool(config.databaseUrl);
const battles = new InteractiveBattleStore();

await app.register(cors, {
  origin: (origin, callback) => {
    const allowed = !origin || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);
    callback(allowed ? null : new Error("Origin not allowed"), allowed);
  },
});

await app.register(staticFiles, {
  root: join(process.cwd(), "dist"),
  prefix: "/",
});

app.get("/api/health", async () => {
  const result = await database.query<{ database_time: string }>("SELECT NOW() AS database_time");
  return {
    ok: true,
    service: "nuzzle-api",
    databaseTime: result.rows[0]?.database_time,
  };
});

app.post("/api/dev/fixture-battle", async () => {
  const result = await runFixtureBattle();
  const id = randomUUID();
  await database.query(
    `INSERT INTO battle_fixture_runs
      (id, format_id, simulator_version, winner, turn_count, transcript)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      id,
      result.formatId,
      "pokemon-showdown@0.11.11",
      result.winner,
      result.turns,
      JSON.stringify(result.transcript),
    ],
  );
  return { id, simulatorVersion: "pokemon-showdown@0.11.11", ...result };
});

app.post("/api/battles", async (request, reply) => {
  try {
    return await battles.create(request.body as Parameters<typeof battles.create>[0]);
  } catch (error) {
    return reply.code(400).send({ error: error instanceof Error ? error.message : "Could not create battle." });
  }
});

app.post<{ Params: { id: string }; Body: { choice?: string } }>("/api/battles/:id/actions", async (request, reply) => {
  try {
    if (!request.body?.choice) throw new Error("A battle choice is required.");
    return await battles.get(request.params.id).choose(request.body.choice);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not apply battle action.";
    return reply.code(message === "Battle not found." ? 404 : 400).send({ error: message });
  }
});

app.addHook("onClose", async () => {
  await database.end();
});

await app.listen({ host: config.host, port: config.port });

