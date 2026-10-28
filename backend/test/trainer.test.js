import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { encounterPokemon } from "../content.js";
import { gameDate, gameNumber, nextRolloverAt } from "../game-clock.js";
import { trainerSprites, TrainerStore, validateTeam } from "../trainer-store.js";

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

test("the Nuzzle day rolls over at midnight America/New_York", () => {
  assert.equal(gameDate(new Date("2026-10-24T03:59:59Z")), "2026-10-23");
  assert.equal(gameDate(new Date("2026-10-24T04:00:00Z")), "2026-10-24");
  assert.equal(gameDate(new Date("2026-12-10T04:59:59Z")), "2026-12-09");
  assert.equal(gameDate(new Date("2026-12-10T05:00:00Z")), "2026-12-10");
  assert.equal(nextRolloverAt(new Date("2026-10-23T14:00:00Z")), "2026-10-24T04:00:00.000Z");
  assert.equal(gameNumber("2026-10-27"), 1);
  assert.equal(gameNumber("2026-10-28"), 2);
});

test("Showdown team imports are normalized and invalid sets are rejected", () => {
  const parsed = validateTeam(mistyTeam.replace("Level: 100", "Shiny: Yes\nLevel: 100"));
  assert.equal(parsed.team.length, 1);
  assert.equal(parsed.team[0].species, "Starmie");
  assert.equal(parsed.team[0].level, 100);
  assert.equal(parsed.team[0].shiny, true);
  assert.throws(() => validateTeam("DefinitelyNotAPokemon\n- Surf"), /Unknown Pokémon/);
});

test("prep trainers support Tangela and Primeape without adding them to encounters", () => {
  const parsed = validateTeam(`Tangela
Ability: Chlorophyll
- Giga Drain

Primeape
Ability: Vital Spirit
- Close Combat`);
  assert.deepEqual(parsed.team.map((pokemon) => pokemon.species), ["Tangela", "Primeape"]);
  assert.equal(encounterPokemon.some((pokemon) => ["tangela", "primeape"].includes(pokemon.id)), false);
});

test("the trainer editor exposes the full Showdown sprite catalog", () => {
  assert.ok(trainerSprites.length >= 1_400);
  for (const id of ["brock", "misty", "cynthia", "red", "youngster-gen9"]) {
    assert.ok(trainerSprites.some((sprite) => sprite.id === id), `missing trainer sprite ${id}`);
  }
});

test("queued trainers can be reordered and publish one immutable snapshot per day", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nuzzle-trainers-"));
  let now = new Date("2026-10-23T15:05:00Z");
  const store = new TrainerStore(path.join(directory, "trainers.json"), { now: () => now });
  await store.initialize();

  const first = await store.current();
  assert.equal(first.date, "2026-10-23");
  assert.equal(first.number, 1);
  assert.equal(first.trainer.name, "Brock");
  assert.deepEqual(first.trainer.pokemon[0].types, ["Steel", "Ground"]);
  assert.ok(first.trainer.pokemon[0].possibleAbilities.includes("Sturdy"));
  assert.deepEqual(first.trainer.pokemon[0].speedRange, { min: 58, max: 174 });
  assert.equal(first.trainer.pokemon[0].speed, undefined, "public scouting data must not reveal the configured Speed stat");
  assert.equal(first.trainer.pokemon[0].ability, undefined, "public scouting data must not reveal the configured ability");
  assert.equal(first.trainer.pokemon[0].moves, undefined, "public scouting data must not reveal the configured moves");

  await store.add({ name: "Misty", spriteId: "misty", teamText: mistyTeam });
  await store.add({ name: "Erika", spriteId: "erika", teamText: erikaTeam.replace("Ability: Chlorophyll", "Ability: Chlorophyll\nShiny: Yes") });
  let admin = await store.adminState();
  assert.deepEqual(admin.queue.map((trainer) => trainer.name), ["Misty", "Erika"]);
  assert.deepEqual(admin.queue.map((trainer) => trainer.scheduledDate), ["2026-10-24", "2026-10-25"]);

  await store.reorder(admin.queue.map((trainer) => trainer.id).reverse());
  admin = await store.adminState();
  assert.deepEqual(admin.queue.map((trainer) => trainer.name), ["Erika", "Misty"]);

  now = new Date("2026-10-24T15:01:00Z");
  const second = await store.current();
  assert.equal(second.trainer.name, "Erika");
  assert.equal(second.trainer.pokemon[0].shiny, true);
  assert.equal(second.opponentTeam[0].species, "Vileplume");
  assert.equal(second.opponentTeam[0].shiny, true);

  await store.add({ name: "Changed Erika", spriteId: "erika", teamText: mistyTeam });
  assert.equal((await store.current()).trainer.name, "Erika", "today's published trainer must remain immutable");
});
