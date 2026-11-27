import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { abilityCatalog, contentSummary, encounterPokemon, itemCatalog, pokemonById, pokemonCatalog } from "../content.js";
import { GameStore, publicContent } from "../game-store.js";
import { encounterSignatureMoves, generateEncounterMoves } from "../movesets.js";

const require = createRequire(import.meta.url);
const { Dex } = require("pokemon-showdown");

async function fixture(now = new Date("2026-11-22T16:00:00Z")) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nuzzle-game-"));
  const filename = path.join(directory, "game.json");
  const store = new GameStore(filename, { timeZone: "America/New_York", now: typeof now === "function" ? now : () => now });
  await store.initialize();
  return { filename, store };
}

test("the approvals snapshot resolves to canonical Pokémon, item, and complete TM catalogs", () => {
  assert.deepEqual(contentSummary(), { pokemon: 522, starters: 30, heldItems: 139, trainingItems: 24, tms: 689 });
  assert.equal(pokemonCatalog.every((pokemon) => pokemonById.has(pokemon.id)), true);
  assert.equal(itemCatalog.filter((item) => item.group === "TMs").length, 689);
  assert.equal(publicContent().items.length, 838);
  assert.equal(publicContent().items.some((item) => ["ev", "iv", "nature"].includes(item.effect)), false);
  assert.equal("natures" in publicContent(), false);
  assert.equal(publicContent().abilities, abilityCatalog);
  assert.equal(abilityCatalog.length > 200, true);
  assert.equal(abilityCatalog.every((ability) => ability.id && ability.name && ability.description), true);
  assert.equal(pokemonById.has("smeargle"), false);
  assert.equal(publicContent().startingMoney, 50000);
  assert.equal(itemCatalog.filter((item) => item.group === "Held Items").every((item) => item.purchaseLimit === 1), true);
  assert.equal(itemCatalog.filter((item) => item.group === "Held Items").every((item) => Number.isInteger(item.spriteNumber)), true);
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
  assert.equal(itemCatalog.find((item) => item.id === "tm-crunch").pp, 24);
  assert.equal(itemCatalog.filter((item) => item.group === "TMs").every((item) => Number.isInteger(item.pp) && item.pp > 0), true);
  assert.equal(itemCatalog.find((item) => item.id === "tm-growl").price, 24000);
  assert.equal(itemCatalog.find((item) => item.id === "tm-splash").price, 100);
  assert.equal(itemCatalog.find((item) => item.id === "tm-aurasphere").price, 1400);
  assert.equal(itemCatalog.find((item) => item.id === "tm-aurorabeam").price, 1050);
  assert.equal(itemCatalog.find((item) => item.id === "tm-acidspray").price, 850);
  assert.equal(itemCatalog.find((item) => item.id === "tm-protect").price, 27500);
  assert.equal(itemCatalog.find((item) => item.id === "tm-detect").price, 27500);
  assert.equal(itemCatalog.find((item) => item.id === "tm-kingsshield").price, 32500);
  assert.equal(itemCatalog.find((item) => item.id === "tm-spikyshield").price, 32500);
  assert.equal(itemCatalog.find((item) => item.id === "tm-endure").price, 32500);
  assert.equal(itemCatalog.find((item) => item.id === "tm-substitute").price, 30000);
  assert.equal(itemCatalog.find((item) => item.id === "tm-snarl").price, 24000);
  assert.equal(itemCatalog.find((item) => item.id === "tm-charm").price, 30000);
  assert.equal(itemCatalog.find((item) => item.id === "tm-partingshot").price, 30000);
  assert.equal(itemCatalog.find((item) => item.id === "tm-moonblast").price, 1550);
  assert.equal(itemCatalog.find((item) => item.id === "tm-toxicspikes").price, 32500);
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
  assert.equal(itemCatalog.some((item) => ["tm-aeroblast", "tm-spore", "tm-swordsdance", "tm-batonpass", "tm-doubleteam", "tm-poweruppunch"].includes(item.id)), false);
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
  assert.equal(encounterPokemon.some((pokemon) => pokemon.id === "shedinja"), false);
  assert.equal(encounterSignatureMoves.aegislash, undefined);
  assert.deepEqual(encounterSignatureMoves.palafin, ["jetpunch"]);
  assert.deepEqual(encounterSignatureMoves.wugtrio, ["tripledive"]);
  assert.deepEqual(encounterSignatureMoves.revavroom, ["spinout"]);
  assert.deepEqual(encounterSignatureMoves.veluza, ["filletaway"]);
});

test("every player receives the same twelve persisted daily trios with an approved starter trio first", async () => {
  const { filename, store } = await fixture();
  const before = await store.get("user-one");
  assert.equal(before.roster.length, 0);
  assert.equal(before.teamIds.length, 0);
  assert.equal(before.battleUnlocked, false);
  assert.equal(before.encounters.length, 12);
  assert.equal(before.encounters[0].kind, "starter");
  assert.equal(before.encounters[0].count, 3);
  assert.equal(before.encounters[0].pokemon, null);

  const revealed = await store.revealEncounter("user-one", 0);
  assert.equal(revealed.roster.length, 0);
  assert.equal(revealed.encounters[0].revealed, true);
  assert.equal(revealed.encounters[0].pokemon.length, 3);
  const approvedStarterTrios = new Set([
    "venusaur,charizard,blastoise", "meganium,typhlosion,feraligatr", "sceptile,blaziken,swampert",
    "torterra,infernape,empoleon", "chesnaught,delphox,greninja", "decidueye,incineroar,primarina",
    "rillaboom,cinderace,inteleon", "decidueyehisui,typhlosionhisui,samurotthisui", "meowscarada,skeledirge,quaquaval",
  ]);
  assert.equal(approvedStarterTrios.has(revealed.encounters[0].pokemon.map((pokemon) => pokemon.speciesId).join(",")), true);
  const revealedSpecies = revealed.encounters[0].pokemon.map((pokemon) => pokemon.speciesId);

  const otherPlayer = await store.revealEncounter("user-two", 0);
  assert.deepEqual(otherPlayer.encounters[0].pokemon, revealed.encounters[0].pokemon);
  assert.equal(otherPlayer.roster.length, 0);

  const restored = new GameStore(filename, { timeZone: "America/New_York", now: () => new Date("2026-11-22T16:00:00Z") });
  await restored.initialize();
  const restoredState = await restored.get("user-one");
  assert.equal(restoredState.encounters[0].revealed, true);
  assert.deepEqual(restoredState.encounters[0].pokemon.map((pokemon) => pokemon.speciesId), revealedSpecies);
  await assert.rejects(restored.revealEncounter("user-one", 1), /revealed encounter first/);

  const first = await restored.claimEncounter("user-one", 0, 1);
  assert.equal(first.roster.length, 1);
  assert.equal(first.teamIds.length, 0);
  assert.equal(first.battleUnlocked, false);
  assert.equal(revealedSpecies.includes(first.roster[0].speciesId), true);
  assert.equal(first.encounters[0].pokemon.length, 1);
  assert.equal(first.encounters[0].pokemon[0].id, first.roster[0].id);

  let after = first;
  for (let slot = 1; slot < 12; slot++) after = await restored.claimEncounter("user-one", slot);
  assert.equal(after.roster.length, 12);
  assert.equal(after.teamIds.length, 0);
  assert.equal(after.battleUnlocked, false);
  assert.equal(after.roster.filter((pokemon) => pokemonCatalog.find((entry) => entry.id === pokemon.speciesId)?.starterEligible).length, 1);
  assert.equal(new Set(after.roster.map((pokemon) => pokemon.encounterFamilyId)).size, 12);
  for (const pokemon of after.roster) {
    assert.equal("evs" in pokemon, false);
    assert.equal("ivs" in pokemon, false);
    assert.equal("nature" in pokemon, false);
    assert.equal(pokemon.ordinaryAbilities.includes(pokemon.ability), true);
    assert.equal(pokemon.moves.length >= 1 && pokemon.moves.length <= 4, true);
  }
  const selected = await restored.setTeam("user-one", after.roster.slice(0, 6).map((pokemon) => pokemon.id));
  assert.equal(selected.teamIds.length, 6);
  assert.equal(selected.battleUnlocked, true);
});

test("the November 22 rollout preserves existing November 21 preparation until midnight", async () => {
  let now = new Date("2026-11-21T16:00:00Z");
  const { store } = await fixture(() => now);
  let state = await store.claimEncounter("rollout-user", 0);
  state = await store.buy("rollout-user", "leftovers", 1);
  const existingRunId = state.runId;
  const existingPokemonId = state.roster[0].id;
  const existingMoney = state.money;
  assert.equal(state.sharedDailyBoxesActive, false);

  state = await store.get("rollout-user");
  assert.equal(state.runId, existingRunId);
  assert.equal(state.roster[0].id, existingPokemonId);
  assert.equal(state.money, existingMoney);

  now = new Date("2026-11-22T16:00:00Z");
  state = await store.revealEncounter("rollout-user", 0);
  assert.equal(state.sharedDailyBoxesActive, true);
  assert.notEqual(state.runId, existingRunId);
  assert.equal(state.roster.length, 0);
  assert.equal(state.money, 50000);
  assert.deepEqual(state.encounters[0].pokemon.map((pokemon) => pokemon.speciesId), ["venusaur", "charizard", "blastoise"]);
});

test("daily rollover clears every box and budget while advancing the starter rotation", async () => {
  let now = new Date("2026-11-22T16:00:00Z");
  const { store } = await fixture(() => now);
  let state = await store.revealEncounter("daily-user", 0);
  assert.deepEqual(state.encounters[0].pokemon.map((pokemon) => pokemon.speciesId), ["venusaur", "charizard", "blastoise"]);
  state = await store.claimEncounter("daily-user", 0, 1);
  state = await store.setTeam("daily-user", [state.roster[0].id]);
  state = await store.buy("daily-user", "leftovers", 1);
  assert.equal(state.money < 50000, true);
  const firstRunId = state.runId;

  now = new Date("2026-11-23T16:00:00Z");
  state = await store.revealEncounter("daily-user", 0);
  assert.notEqual(state.runId, firstRunId);
  assert.equal(state.money, 50000);
  assert.equal(state.roster.length, 0);
  assert.deepEqual(state.teamIds, []);
  assert.deepEqual(state.inventory, {});
  assert.deepEqual(state.encounters[0].pokemon.map((pokemon) => pokemon.speciesId), ["meganium", "typhlosion", "feraligatr"]);

  now = new Date("2026-11-30T16:00:00Z");
  state = await store.revealEncounter("daily-user", 0);
  assert.deepEqual(state.encounters[0].pokemon.map((pokemon) => pokemon.speciesId), ["meowscarada", "skeledirge", "quaquaval"]);
  now = new Date("2026-12-01T16:00:00Z");
  state = await store.revealEncounter("daily-user", 0);
  assert.deepEqual(state.encounters[0].pokemon.map((pokemon) => pokemon.speciesId), ["venusaur", "charizard", "blastoise"]);
});

test("new daily boxes offer the same twelve choose-one-of-three encounters to every player", async () => {
  const { store } = await fixture(new Date("2026-11-27T16:00:00Z"));
  const alpha = await store.get("shared-alpha");
  const beta = await store.get("shared-beta");
  assert.equal(alpha.encounters.length, 12);
  assert.deepEqual(alpha.encounters, beta.encounters);
  assert.equal(alpha.encounters.every((encounter) => encounter.count === 3 && encounter.pokemon === null), true);

  const encounteredFamilies = new Set();
  for (const { slot } of alpha.encounters) {
    const revealedAlpha = await store.revealEncounter("shared-alpha", slot);
    const revealedBeta = await store.revealEncounter("shared-beta", slot);
    const choices = revealedAlpha.encounters[slot].pokemon;
    assert.equal(choices.length, 3);
    assert.deepEqual(choices, revealedBeta.encounters[slot].pokemon);
    for (const pokemon of choices) encounteredFamilies.add(pokemon.encounterFamilyId);
    const claimedAlpha = await store.claimEncounter("shared-alpha", slot, 1);
    const claimedBeta = await store.claimEncounter("shared-beta", slot, 2);
    assert.equal(claimedAlpha.roster.length, slot + 1);
    assert.equal(claimedAlpha.roster[slot].id, choices[1].id);
    assert.equal(claimedBeta.roster[slot].id, choices[2].id);
  }
  assert.equal(encounteredFamilies.size, 36);
});

test("developer reset clears personal choices without rerolling the shared daily encounters", async () => {
  const { store } = await fixture(new Date("2026-11-22T16:00:00Z"));
  const before = await store.revealEncounter("developer-reset-user", 0);
  const sharedTrio = before.encounters[0].pokemon;
  await store.claimEncounter("developer-reset-user", 0, 2);
  const reset = await store.resetForTesting("developer-reset-user");
  assert.equal(reset.roster.length, 0);
  assert.equal(reset.money, 50000);
  assert.equal(reset.encounters.length, 12);
  assert.equal(reset.encounters.every((encounter) => !encounter.revealed && !encounter.claimed), true);
  const revealedAgain = await store.revealEncounter("developer-reset-user", 0);
  assert.deepEqual(revealedAgain.encounters[0].pokemon, sharedTrio);
});

test("guest promotion preserves today's choices but all accounts reset on the next date", async () => {
  let now = new Date("2026-11-22T16:00:00Z");
  const { store } = await fixture(() => now);
  store.identifyGuest("converted-player");
  let state = await store.claimEncounter("converted-player", 0);
  const runId = state.runId;
  state = await store.promoteGuest("converted-player");
  assert.equal(state.runId, runId);
  assert.equal(state.roster.length, 1);
  now = new Date("2026-11-23T16:00:00Z");
  state = await store.get("converted-player");
  assert.notEqual(state.runId, runId);
  assert.equal(state.roster.length, 0);
});

test("held-item purchases, atomic training builds, and battle snapshots are server-authoritative", async () => {
  const { store } = await fixture();
  let state = await store.get("shop-user");
  for (let slot = 0; slot < 12; slot++) state = await store.claimEncounter("shop-user", slot);
  state = await store.setTeam("shop-user", state.roster.slice(0, 6).map((pokemon) => pokemon.id));
  state = await store.buy("shop-user", "leftovers", 1);
  const ownedLeftovers = state.inventory.leftovers;
  await assert.rejects(store.buy("shop-user", "leftovers", 1), /once per run/i);
  const [firstHolder, secondHolder, wrongSource] = state.roster.filter((pokemon) => !pokemon.heldItemId);
  state = await store.equip("shop-user", firstHolder.id, "leftovers");
  assert.equal(state.roster.find((pokemon) => pokemon.id === firstHolder.id).heldItemId, "leftovers");
  await assert.rejects(store.equip("shop-user", secondHolder.id, "leftovers"), /no unequipped/i);
  await assert.rejects(store.equip("shop-user", secondHolder.id, "leftovers", wrongSource.id), /no longer holding/i);
  state = await store.equip("shop-user", secondHolder.id, "leftovers", firstHolder.id);
  assert.equal(state.roster.find((pokemon) => pokemon.id === firstHolder.id).heldItemId, null);
  assert.equal(state.inventory.leftovers, ownedLeftovers, "transferring an item must not change how many are owned");
  assert.equal(state.roster.find((pokemon) => pokemon.id === secondHolder.id).heldItemId, "leftovers");
  await assert.rejects(store.equip("shop-user", firstHolder.id, "leftovers", firstHolder.id), /no longer holding/i);
  state = await store.unequip("shop-user", secondHolder.id);
  assert.equal(state.roster.find((pokemon) => pokemon.id === secondHolder.id).heldItemId, null);
  await assert.rejects(store.unequip("shop-user", firstHolder.id), /not holding/i);
  const target = state.roster[0];
  await assert.rejects(store.buy("shop-user", "hpup", 5), /directly from the PC/i);

  const tm = itemCatalog.find((item) => item.group === "TMs" && target.learnableMoveIds.includes(item.moveId) && !target.moves.some((move) => move.toLowerCase().replace(/[^a-z0-9]+/g, "") === item.moveId));
  assert.ok(tm, "the generated Pokémon should have at least one teachable TM");
  const previousMove = target.moves[0];
  const build = {
    speciesId: target.speciesId,
    ivs: { hp: 0 },
    evs: { hp: 252 },
    nature: "Adamant",
    ability: target.ability,
    moves: [tm.move, ...target.moves.slice(1)],
  };
  const quote = await store.quoteTrainingBuild("shop-user", target.id, build);
  assert.equal(quote.total, tm.price);
  assert.equal("ivs" in quote.build, false);
  assert.equal("evs" in quote.build, false);
  assert.equal("nature" in quote.build, false);
  const moneyBeforeTraining = state.money;
  await assert.rejects(store.applyTrainingBuild("shop-user", target.id, build, quote.total - 1, "wrong-price"), /price changed/i);
  const applied = await store.applyTrainingBuild("shop-user", target.id, build, quote.total, "training-one");
  state = applied.state;
  assert.equal(state.money, moneyBeforeTraining - quote.total);
  assert.equal("evs" in state.roster.find((pokemon) => pokemon.id === target.id), false);
  assert.equal(state.roster.find((pokemon) => pokemon.id === target.id).moves[0], tm.move);
  assert.notEqual(previousMove, tm.move);
  const retried = await store.applyTrainingBuild("shop-user", target.id, build, quote.total, "training-one");
  assert.equal(retried.applied, false);
  assert.equal(retried.state.money, state.money);

  const trained = state.roster.find((pokemon) => pokemon.id === target.id);
  const ignoredStatBuild = { ...trained, ivs: { hp: 0 }, evs: { hp: 252 }, nature: "Adamant" };
  const ignoredStatQuote = await store.quoteTrainingBuild("shop-user", target.id, ignoredStatBuild);
  assert.equal(ignoredStatQuote.changed, false);
  assert.equal(ignoredStatQuote.total, 0);
  await assert.rejects(store.applyTrainingBuild("shop-user", target.id, ignoredStatBuild, 0, "ignored-stats"), /at least one training change/i);

  const team = await store.battleTeam("shop-user", state.teamIds, state.teamIds[2]);
  assert.equal(team[0].species, pokemonById.get(state.teamIds[2]).showdownName);
  assert.deepEqual(team[0].ivs, { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 });
  assert.deepEqual(team[0].evs, { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
  assert.equal(team[0].nature, "Serious");
});

test("legacy training and TM inventory is refunded once", async () => {
  const { store } = await fixture();
  await store.get("migration-user");
  const run = store.data.runs["migration-user"];
  run.directTrainingVersion = 0;
  run.inventory.hpup = 12;
  run.inventory["tm-thunderbolt"] = 2;
  const before = run.money;
  const state = await store.get("migration-user");
  assert.equal(state.money, before + 12 * 10 + 2 * 1500);
  assert.equal(state.inventory.hpup, undefined);
  assert.equal(state.inventory["tm-thunderbolt"], undefined);
  const again = await store.get("migration-user");
  assert.equal(again.money, state.money);
});

test("legacy player stats are removed and balances below ₽50,000 are restored once", async () => {
  const { filename, store } = await fixture();
  let state = await store.claimEncounter("stats-migration-user", 0);
  const run = store.data.runs["stats-migration-user"];
  run.simplifiedPlayerStatsVersion = 0;
  run.money = 1234;
  run.roster[0].ivs = { hp: 1, atk: 2, def: 3, spa: 4, spd: 5, spe: 6 };
  run.roster[0].evs = { hp: 252, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  run.roster[0].nature = "Adamant";
  run.daily.encounters[1].pokemon[0].ivs = { hp: 0 };
  run.daily.encounters[1].pokemon[0].evs = { hp: 252 };
  run.daily.encounters[1].pokemon[0].nature = "Modest";
  await store.save();

  const restored = new GameStore(filename, { timeZone: "America/New_York", now: () => new Date("2026-10-20T16:00:00Z") });
  await restored.initialize();
  state = await restored.get("stats-migration-user");
  assert.equal(state.money, 50000);
  assert.equal([state.roster[0], restored.data.runs["stats-migration-user"].daily.encounters[1].pokemon[0]].every((pokemon) => !("ivs" in pokemon) && !("evs" in pokemon) && !("nature" in pokemon)), true);
  restored.data.runs["stats-migration-user"].money = 42000;
  state = await restored.get("stats-migration-user");
  assert.equal(state.money, 42000, "ordinary spending after the one-time migration must not trigger another top-up");
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

test("battle settlement records completion without changing the daily preparation state", async () => {
  const { store } = await fixture();
  let state = await store.claimEncounter("faint-user", 0);
  state = await store.claimEncounter("faint-user", 1);
  const [fainted, survivor] = state.roster;
  state = await store.setTeam("faint-user", [fainted.id, survivor.id]);
  state = await store.buy("faint-user", "leftovers", 1);
  state = await store.equip("faint-user", fainted.id, "leftovers");

  const moneyBeforeVictory = state.money;
  state = await store.settleBattle("faint-user", "partial-loss", { faintedPokemonIds: [fainted.id], won: true });
  assert.deepEqual(state.roster.map((pokemon) => pokemon.id), [fainted.id, survivor.id]);
  assert.deepEqual(state.teamIds, [fainted.id, survivor.id]);
  assert.equal(state.inventory.leftovers, 1);
  assert.equal(state.money, moneyBeforeVictory);

  const repeated = await store.settleBattle("faint-user", "partial-loss", { faintedPokemonIds: [survivor.id], won: true });
  assert.deepEqual(repeated.roster.map((pokemon) => pokemon.id), [fainted.id, survivor.id]);
  assert.equal(repeated.money, state.money, "a retried settlement must not change the daily budget");
});
