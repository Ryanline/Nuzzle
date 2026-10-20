import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { contentSummary, itemCatalog, pokemonById, pokemonCatalog } from "../content.js";
import { GameStore, publicContent } from "../game-store.js";

async function fixture(now = new Date("2026-10-20T16:00:00Z")) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nuzzle-game-"));
  const filename = path.join(directory, "game.json");
  const store = new GameStore(filename, { timeZone: "America/New_York", now: () => now });
  await store.initialize();
  return { filename, store };
}

test("the approvals snapshot resolves to canonical Pokémon and item catalogs without TMs", () => {
  assert.deepEqual(contentSummary(), { pokemon: 523, starters: 30, heldItems: 139, trainingItems: 24 });
  assert.equal(pokemonCatalog.every((pokemon) => pokemonById.has(pokemon.id)), true);
  assert.equal(itemCatalog.some((item) => item.group === "TMs"), false);
  assert.equal(publicContent().items.length, 163);
});

test("a new run starts empty and its first encounter grants twelve distinct Pokémon", async () => {
  const { store } = await fixture();
  const before = await store.get("user-one");
  assert.equal(before.roster.length, 0);
  assert.equal(before.teamIds.length, 0);
  assert.equal(before.battleUnlocked, false);
  assert.equal(before.encounters.length, 3);
  assert.equal(before.encounters[0].kind, "opening");
  assert.equal(before.encounters[0].count, 12);
  assert.equal(before.encounters[0].pokemon, null);

  const after = await store.claimEncounter("user-one", 0);
  assert.equal(after.roster.length, 12);
  assert.equal(after.teamIds.length, 6);
  assert.equal(after.battleUnlocked, true);
  assert.equal(after.roster.filter((pokemon) => pokemonCatalog.find((entry) => entry.id === pokemon.speciesId)?.starterEligible).length, 1);
  assert.equal(new Set(after.roster.map((pokemon) => pokemon.encounterFamilyId)).size, 12);
  for (const pokemon of after.roster) {
    assert.deepEqual(Object.values(pokemon.evs), [0, 0, 0, 0, 0, 0]);
    assert.equal(Object.values(pokemon.ivs).every((value) => value >= 0 && value <= 31), true);
    assert.equal(pokemon.ordinaryAbilities.includes(pokemon.ability), true);
    assert.equal(pokemon.moves.length >= 1 && pokemon.moves.length <= 4, true);
  }
});

test("Sunday provides four persisted encounters and restoring the store does not reroll them", async () => {
  const { filename, store } = await fixture(new Date("2026-10-25T16:00:00Z"));
  const initial = await store.get("sunday-user");
  assert.equal(initial.encounters.length, 4);
  const claimed = await store.claimEncounter("sunday-user", 1);
  const species = claimed.encounters[1].pokemon[0].speciesId;

  const restored = new GameStore(filename, { timeZone: "America/New_York", now: () => new Date("2026-10-25T20:00:00Z") });
  await restored.initialize();
  const state = await restored.get("sunday-user");
  assert.equal(state.encounters[1].pokemon[0].speciesId, species);
});

test("the first game date of a new month resets the run to an empty opening encounter", async () => {
  let now = new Date("2026-10-31T16:00:00Z");
  const directory = await mkdtemp(path.join(os.tmpdir(), "nuzzle-month-"));
  const store = new GameStore(path.join(directory, "game.json"), { timeZone: "America/New_York", now: () => now });
  await store.initialize();
  const october = await store.claimEncounter("monthly-user", 0);
  assert.equal(october.roster.length, 12);
  now = new Date("2026-11-01T16:00:00Z");
  const november = await store.get("monthly-user");
  assert.equal(november.roster.length, 0);
  assert.equal(november.money, 2500);
  assert.equal(november.encounters[0].kind, "opening");
  assert.equal(november.encounters[0].count, 12);
});

test("shop limits, stack purchases, EV use, and battle snapshots are server-authoritative", async () => {
  const { store } = await fixture();
  let state = await store.claimEncounter("shop-user", 0);
  state = await store.buy("shop-user", "leftovers", 1);
  await assert.rejects(store.buy("shop-user", "leftovers", 1), /once per run/i);
  state = await store.buy("shop-user", "hpup", 5);
  const target = state.roster[0];
  state = await store.useTrainingItem("shop-user", target.id, "hpup", { quantity: 5 });
  assert.equal(state.roster.find((pokemon) => pokemon.id === target.id).evs.hp, 5);
  assert.equal(state.inventory.hpup, undefined);

  const team = await store.battleTeam("shop-user", state.teamIds, state.teamIds[2]);
  assert.equal(team[0].species, pokemonById.get(state.teamIds[2]).showdownName);
  assert.deepEqual(team[0].evs, state.roster.find((pokemon) => pokemon.id === state.teamIds[2]).evs);
});
