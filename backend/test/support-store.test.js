import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import { SupportStore } from "../support-store.js";

test("support records keep idempotent JSONL events and compressed daily snapshots", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nuzzle-support-"));
  const now = new Date("2026-11-09T16:00:00Z");
  const store = new SupportStore(directory, { timeZone: "America/New_York", now: () => now });
  await store.initialize();

  assert.equal(await store.record({ id: "battle:one", type: "battle_completed", gameDate: "2026-11-09", streakAfter: 4 }), true);
  assert.equal(await store.record({ id: "battle:one", type: "battle_completed", gameDate: "2026-11-09", streakAfter: 4 }), false);
  assert.equal(await store.record({ id: "battle:expired", type: "battle_completed", gameDate: "2026-09-01", streakAfter: 1 }), false);
  await store.snapshot("2026-11-09", { game: { version: 2, runs: { player: { id: "run-one" } } } });
  await store.snapshot("2026-11-09", { game: { version: 2, runs: {} } });

  const events = (await readFile(path.join(directory, "events", "2026-11-09.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
  assert.equal(events.length, 1);
  assert.equal(events[0].streakAfter, 4);
  const snapshotNames = await readdir(path.join(directory, "snapshots"));
  assert.deepEqual(snapshotNames, ["2026-11-09.json.gz"]);
  const snapshot = JSON.parse(gunzipSync(await readFile(path.join(directory, "snapshots", snapshotNames[0]))));
  assert.equal(snapshot.game.runs.player.id, "run-one");
});
