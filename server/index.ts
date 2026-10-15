import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import staticFiles from "@fastify/static";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { getConfig } from "./config.js";
import { createPool } from "./db/pool.js";
import { runFixtureBattle } from "./showdown/fixture-battle.js";

const config = getConfig();
const app = Fastify({ logger: true });
const database = createPool(config.databaseUrl);

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

app.addHook("onClose", async () => {
  await database.end();
});

await app.listen({ host: config.host, port: config.port });

