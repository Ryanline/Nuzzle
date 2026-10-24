import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { contentSummary, itemCatalog, pokemonById, pokemonCatalog } from "../content.js";
import { GameStore, publicContent } from "../game-store.js";
import { encounterSignatureMoves, generateEncounterMoves } from "../movesets.js";

const require = createRequire(import.meta.url);
const { Dex } = require("pokemon-showdown");

async function fixture(now = new Date("2026-10-20T16:00:00Z")) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nuzzle-game-"));
  const filename = path.join(directory, "game.json");
  const store = new GameStore(filename, { timeZone: "America/New_York", now: () => now });
  await store.initialize();
  return { filename, store };
}

test("the approvals snapshot resolves to canonical Pokémon, item, and complete TM catalogs", () => {
  assert.deepEqual(contentSummary(), { pokemon: 522, starters: 30, heldItems: 139, trainingItems: 24, tms: 690 });
  assert.equal(pokemonCatalog.every((pokemon) => pokemonById.has(pokemon.id)), true);
  assert.equal(itemCatalog.filter((item) => item.group === "TMs").length, 690);
  assert.equal(publicContent().items.length, 853);
  assert.equal(pokemonById.has("smeargle"), false);
  assert.equal(publicContent().startingMoney, 50000);
  assert.equal(itemCatalog.filter((item) => item.group === "Held Items").every((item) => item.purchaseLimit === 1), true);
  const formChangers = itemCatalog.filter((item) => ["form", "rotom"].includes(item.effect));
  assert.equal(formChangers.length, 8);
  assert.equal(formChangers.every((item) => item.consumable && item.purchaseLimit === null), true);
  assert.equal(itemCatalog.find((item) => item.id === "leftovers").price, 2500);
  assert.equal(itemCatalog.find((item) => item.id === "bottlecap").price, 900);
  assert.equal(itemCatalog.find((item) => item.id === "naturemint").price, 1500);
  assert.equal(itemCatalog.find((item) => item.id === "abilitycapsule").price, 2000);
  assert.equal(itemCatalog.find((item) => item.id === "abilitypatch").price, 3000);
  assert.equal(itemCatalog.find((item) => item.id === "tm-thunderbolt").price, 1500);
  assert.equal(itemCatalog.find((item) => item.id === "tm-aerialace").price, 1100);
  assert.equal(itemCatalog.find((item) => item.id === "tm-thunder").price, 1650);
  assert.equal(itemCatalog.find((item) => item.id === "tm-recover").price, 2000);
  assert.equal(itemCatalog.find((item) => item.id === "tm-reflect").price, 1350);
  assert.equal(itemCatalog.find((item) => item.id === "tm-thunderwave").price, 1000);
  assert.equal(itemCatalog.find((item) => item.id === "tm-sleeppowder").price, 750);
  assert.equal(itemCatalog.find((item) => item.id === "tm-growl").price, 250);
  assert.equal(itemCatalog.find((item) => item.id === "tm-splash").price, 100);
  assert.equal(itemCatalog.find((item) => item.id === "tm-aurasphere").price, 1400);
  assert.equal(itemCatalog.find((item) => item.id === "tm-aurorabeam").price, 1050);
  assert.equal(itemCatalog.find((item) => item.id === "tm-acidspray").price, 850);
  assert.equal(itemCatalog.find((item) => item.id === "tm-protect").price, 2000);
  assert.equal(itemCatalog.find((item) => item.id === "tm-kingsshield").price, 2000);
  assert.equal(itemCatalog.find((item) => item.id === "tm-suckerpunch").price, 1650);
  assert.equal(itemCatalog.find((item) => item.id === "tm-extremespeed").price, 1800);
  assert.equal(itemCatalog.find((item) => item.id === "tm-fierydance").price, 1800);
  assert.equal(itemCatalog.find((item) => item.id === "tm-drainpunch").price, 1700);
  assert.equal(itemCatalog.find((item) => item.id === "tm-dualchop").price, 1200);
  assert.equal(itemCatalog.find((item) => item.id === "tm-bulletseed").price, 1400);
  assert.equal(itemCatalog.find((item) => item.id === "tm-electroball").price, 1000);
  assert.equal(itemCatalog.find((item) => item.id === "tm-raindance").price, 1200);
  assert.equal(itemCatalog.find((item) => item.id === "tm-synthesis").price, 1750);
  assert.equal(itemCatalog.find((item) => item.id === "tm-perishsong").price, 2000);
  assert.equal(itemCatalog.find((item) => item.id === "tm-populationbomb").price, 2400);
  assert.equal(itemCatalog.find((item) => item.id === "tm-aurawheel").price, 1800);
  assert.equal(itemCatalog.find((item) => item.id === "tm-focuspunch").price, 1800);
  assert.equal(itemCatalog.find((item) => item.id === "tm-lastresort").price, 1800);
  assert.equal(itemCatalog.find((item) => item.id === "tm-rapidspin").price, 1300);
  assert.equal(itemCatalog.find((item) => item.id === "tm-dreameater").price, 1100);
  assert.equal(itemCatalog.some((item) => ["tm-aeroblast", "tm-spore", "tm-swordsdance", "tm-batonpass", "tm-doubleteam"].includes(item.id)), false);
  assert.equal(itemCatalog.filter((item) => item.group === "TMs").every((item) => item.price % 50 === 0), true);
});

test("encounter movesets guarantee damaging STAB and approved signature moves", () => {
  const noConventionalStab = new Set(["ditto", "pyukumuku", "unown", "wobbuffet"]);
  for (const pokemon of pokemonCatalog) {
    const moves = generateEncounterMoves(pokemon.id).map((name) => Dex.moves.get(name));
    assert.equal(moves.length, 4, `${pokemon.name} should receive four moves`);
    for (const type of pokemon.types) {
      if (noConventionalStab.has(pokemon.id)) continue;
      const hasStab = moves.some((move) => move.category !== "Status" && (move.type === type || (move.id === "revelationdance" && pokemon.id.startsWith("oricorio") && type !== "Flying")));
      assert.equal(hasStab, true, `${pokemon.name} should receive damaging ${type} STAB: ${moves.map((move) => move.name).join(", ")}`);
    }
    for (const signature of encounterSignatureMoves[pokemon.id] || []) {
      assert.equal(moves.some((move) => move.id === signature), true, `${pokemon.name} should receive ${Dex.moves.get(signature).name}`);
    }
    for (const move of moves.filter((candidate) => candidate.category !== "Status")) {
      assert.equal(move.accuracy === true || move.accuracy >= 70, true, `${pokemon.name} should not receive ${move.name} below the accuracy floor`);
    }
  }
  assert.equal(pokemonCatalog.some((pokemon) => pokemon.id === "smeargle"), false);
  assert.deepEqual(encounterSignatureMoves.palafin, ["jetpunch"]);
  assert.deepEqual(encounterSignatureMoves.wugtrio, ["tripledive"]);
  assert.deepEqual(encounterSignatureMoves.revavroom, ["spinout"]);
  assert.deepEqual(encounterSignatureMoves.veluza, ["filletaway"]);
});

test("a new run starts empty and offers twelve individually claimed encounters", async () => {
  const { store } = await fixture();
  const before = await store.get("user-one");
  assert.equal(before.roster.length, 0);
  assert.equal(before.teamIds.length, 0);
  assert.equal(before.battleUnlocked, false);
  assert.equal(before.encounters.length, 12);
  assert.equal(before.encounters[0].kind, "opening");
  assert.equal(before.encounters[0].count, 1);
  assert.equal(before.encounters[0].pokemon, null);

  const first = await store.claimEncounter("user-one", 0);
  assert.equal(first.roster.length, 1);
  assert.equal(first.teamIds.length, 1);
  assert.equal(first.battleUnlocked, true);
  assert.equal(pokemonCatalog.find((entry) => entry.id === first.roster[0].speciesId)?.starterEligible, true);

  let after = first;
  for (let slot = 1; slot < 12; slot++) after = await store.claimEncounter("user-one", slot);
  assert.equal(after.roster.length, 12);
  assert.equal(after.teamIds.length, 6);
  assert.equal(after.roster.filter((pokemon) => pokemonCatalog.find((entry) => entry.id === pokemon.speciesId)?.starterEligible).length, 1);
  assert.equal(new Set(after.roster.map((pokemon) => pokemon.encounterFamilyId)).size, 12);
  for (const pokemon of after.roster) {
    assert.deepEqual(Object.values(pokemon.evs), [0, 0, 0, 0, 0, 0]);
    assert.equal(Object.values(pokemon.ivs).every((value) => value >= 0 && value <= 31), true);
    assert.equal(pokemon.ordinaryAbilities.includes(pokemon.ability), true);
    assert.equal(pokemon.moves.length >= 1 && pokemon.moves.length <= 4, true);
  }
});

test("a wipe immediately starts a fresh run without changing the game date", async () => {
  const { store } = await fixture();
  let state = await store.get("wipe-user");
  for (let slot = 0; slot < 12; slot++) state = await store.claimEncounter("wipe-user", slot);
  state = await store.buy("wipe-user", "hpup", 4);
  const previousRunId = state.runId;

  const reset = await store.resetAfterWipe("wipe-user", "lost-battle");
  assert.notEqual(reset.runId, previousRunId);
  assert.equal(reset.date, "2026-10-20");
  assert.equal(reset.money, 50000);
  assert.equal(reset.roster.length, 0);
  assert.equal(reset.teamIds.length, 0);
  assert.deepEqual(reset.inventory, {});
  assert.deepEqual(reset.purchasedUnique, []);
  assert.equal(reset.battleUnlocked, false);
  assert.equal(reset.encounters.length, 12);
  assert.equal(reset.encounters.every((encounter) => encounter.kind === "opening" && !encounter.claimed), true);

  const repeated = await store.resetAfterWipe("wipe-user", "lost-battle");
  assert.equal(repeated.runId, reset.runId);
  assert.deepEqual(repeated.encounters, reset.encounters);
});

test("Sunday provides four persisted encounters and restoring the store does not reroll them", async () => {
  let now = new Date("2026-10-24T16:00:00Z");
  const directory = await mkdtemp(path.join(os.tmpdir(), "nuzzle-sunday-"));
  const filename = path.join(directory, "game.json");
  const store = new GameStore(filename, { timeZone: "America/New_York", now: () => now });
  await store.initialize();
  await store.get("sunday-user");
  for (let slot = 0; slot < 12; slot++) await store.claimEncounter("sunday-user", slot);
  now = new Date("2026-10-25T16:00:00Z");
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
  assert.equal(october.roster.length, 1);
  now = new Date("2026-11-01T16:00:00Z");
  const november = await store.get("monthly-user");
  assert.equal(november.roster.length, 0);
  assert.equal(november.money, 50000);
  assert.equal(november.encounters.length, 12);
  assert.equal(november.encounters[0].kind, "opening");
  assert.equal(november.encounters[0].count, 1);
});

test("shop limits, stack purchases, EV use, and battle snapshots are server-authoritative", async () => {
  const { store } = await fixture();
  let state = await store.get("shop-user");
  for (let slot = 0; slot < 12; slot++) state = await store.claimEncounter("shop-user", slot);
  state = await store.buy("shop-user", "leftovers", 1);
  await assert.rejects(store.buy("shop-user", "leftovers", 1), /once per run/i);
  const firstHolder = state.roster[0];
  const secondHolder = state.roster[1];
  state = await store.equip("shop-user", firstHolder.id, "leftovers");
  assert.equal(state.roster.find((pokemon) => pokemon.id === firstHolder.id).heldItemId, "leftovers");
  await assert.rejects(store.equip("shop-user", secondHolder.id, "leftovers"), /no unequipped/i);
  state = await store.unequip("shop-user", firstHolder.id);
  assert.equal(state.roster.find((pokemon) => pokemon.id === firstHolder.id).heldItemId, null);
  assert.equal(state.inventory.leftovers, 1);
  state = await store.equip("shop-user", secondHolder.id, "leftovers");
  assert.equal(state.roster.find((pokemon) => pokemon.id === secondHolder.id).heldItemId, "leftovers");
  await assert.rejects(store.unequip("shop-user", firstHolder.id), /not holding/i);
  state = await store.buy("shop-user", "hpup", 5);
  const target = state.roster[0];
  state = await store.useTrainingItem("shop-user", target.id, "hpup", { quantity: 5 });
  assert.equal(state.roster.find((pokemon) => pokemon.id === target.id).evs.hp, 5);
  assert.equal(state.inventory.hpup, undefined);

  const refreshedTarget = state.roster.find((pokemon) => pokemon.id === target.id);
  const tm = itemCatalog.find((item) => item.group === "TMs" && refreshedTarget.learnableMoveIds.includes(item.moveId) && !refreshedTarget.moves.some((move) => move.toLowerCase().replace(/[^a-z0-9]+/g, "") === item.moveId));
  assert.ok(tm, "the generated Pokémon should have at least one teachable TM");
  state = await store.buy("shop-user", tm.id, 1);
  const previousMove = state.roster.find((pokemon) => pokemon.id === target.id).moves[0];
  state = await store.useTrainingItem("shop-user", target.id, tm.id, { slot: 0 });
  assert.equal(state.roster.find((pokemon) => pokemon.id === target.id).moves[0], tm.move);
  assert.notEqual(previousMove, tm.move);
  assert.equal(state.inventory[tm.id], undefined);

  const team = await store.battleTeam("shop-user", state.teamIds, state.teamIds[2]);
  assert.equal(team[0].species, pokemonById.get(state.teamIds[2]).showdownName);
  assert.deepEqual(team[0].evs, state.roster.find((pokemon) => pokemon.id === state.teamIds[2]).evs);
});

test("stolen battle items persist once and equip only to an empty-handed owner", async () => {
  const { store } = await fixture();
  let state = await store.claimEncounter("item-thief", 0);
  const pokemon = state.roster[0];
  state = await store.applyBattleItemAcquisitions("item-thief", "battle-one", [{ pokemonId: pokemon.id, itemId: "leftovers" }]);
  assert.equal(state.inventory.leftovers, 1);
  assert.equal(state.roster.find((candidate) => candidate.id === pokemon.id).heldItemId, "leftovers");
  state = await store.applyBattleItemAcquisitions("item-thief", "battle-one", [{ pokemonId: pokemon.id, itemId: "leftovers" }]);
  assert.equal(state.inventory.leftovers, 1);
  state = await store.applyBattleItemAcquisitions("item-thief", "battle-two", [{ pokemonId: pokemon.id, itemId: "choiceband" }]);
  assert.equal(state.inventory.choiceband, undefined);
  assert.equal(state.roster.find((candidate) => candidate.id === pokemon.id).heldItemId, "leftovers");
});
