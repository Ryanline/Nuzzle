import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { gameDate, gameNumber, nextRolloverAt } from "../game-clock.js";
import { TrainerStore, validateTeam } from "../trainer-store.js";

const mistyTeam = `Starmie @ Leftovers
Ability: Natural Cure
Level: 100
- Surf
- Psychic
- Ice Beam
- Recover`;

const erikaTeam = `Vileplume
Ability: Chlorophyll
Level: 100
- Giga Drain
- Sludge Bomb
- Moonblast
- Sleep Powder`;

test("the Nuzzle day rolls over at 11:00 AM America/New_York", () => {
  assert.equal(gameDate(new Date("2026-10-23T14:59:59Z")), "2026-10-22");
  assert.equal(gameDate(new Date("2026-10-23T15:00:00Z")), "2026-10-23");
  assert.equal(gameDate(new Date("2026-12-10T15:59:59Z")), "2026-12-09");
  assert.equal(gameDate(new Date("2026-12-10T16:00:00Z")), "2026-12-10");
  assert.equal(nextRolloverAt(new Date("2026-10-23T14:00:00Z")), "2026-10-23T15:00:00.000Z");
  assert.equal(gameNumber("2026-10-23"), 9);
});

test("Showdown team imports are normalized and invalid sets are rejected", () => {
  const parsed = validateTeam(mistyTeam);
  assert.equal(parsed.team.length, 1);
  assert.equal(parsed.team[0].species, "Starmie");
  assert.equal(parsed.team[0].level, 100);
  assert.throws(() => validateTeam("DefinitelyNotAPokemon\n- Surf"), /Unknown Pokémon/);
});

test("queued trainers can be reordered and publish one immutable snapshot per day", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nuzzle-trainers-"));
  let now = new Date("2026-10-23T15:05:00Z");
  const store = new TrainerStore(path.join(directory, "trainers.json"), { now: () => now });
  await store.initialize();

  const first = await store.current();
  assert.equal(first.date, "2026-10-23");
  assert.equal(first.number, 9);
  assert.equal(first.trainer.name, "Brock");

  await store.add({ name: "Misty", spriteId: "misty", teamText: mistyTeam });
  await store.add({ name: "Erika", spriteId: "erika", teamText: erikaTeam });
  let admin = await store.adminState();
  assert.deepEqual(admin.queue.map((trainer) => trainer.name), ["Misty", "Erika"]);
  assert.deepEqual(admin.queue.map((trainer) => trainer.scheduledDate), ["2026-10-24", "2026-10-25"]);

  await store.reorder(admin.queue.map((trainer) => trainer.id).reverse());
  admin = await store.adminState();
  assert.deepEqual(admin.queue.map((trainer) => trainer.name), ["Erika", "Misty"]);

  now = new Date("2026-10-24T15:01:00Z");
  const second = await store.current();
  assert.equal(second.trainer.name, "Erika");
  assert.equal(second.opponentTeam[0].species, "Vileplume");

  await store.add({ name: "Changed Erika", spriteId: "erika", teamText: mistyTeam });
  assert.equal((await store.current()).trainer.name, "Erika", "today's published trainer must remain immutable");
});
