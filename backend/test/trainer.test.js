import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { customBattleSpecies } from "../custom-battle-species.js";
import { encounterPokemon, pokemonCatalog } from "../content.js";
import { gameDate, gameNumber, nextRolloverAt } from "../game-clock.js";
import { trainerSprites, TrainerStore, validateTeam } from "../trainer-store.js";
import { applyLiveTrainerAdjustments } from "../live-trainer-adjustments.js";

const require = createRequire(import.meta.url);
const { Dex } = require("pokemon-showdown");

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

test("battle-only Digimon accept arbitrary valid Pokepaste builds without entering player catalogs", () => {
  const parsed = validateTeam(`Greymon @ Choice Specs
Ability: Levitate
EVs: 4 HP / 252 SpA / 252 Spe
Timid Nature
- Hydro Pump
- Psychic
- Ice Beam
- Recover`);
  assert.equal(parsed.team[0].species, "Greymon");
  assert.equal(parsed.team[0].item, "Choice Specs");
  assert.equal(parsed.team[0].ability, "Levitate");
  assert.deepEqual(parsed.team[0].moves, ["Hydro Pump", "Psychic", "Ice Beam", "Recover"]);
  assert.deepEqual(parsed.team[0].evs, { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 });

  const expected = {
    Angemon: { types: ["Fairy", "Flying"], bst: 540, weightkg: 65 },
    Garurumon: { types: ["Ice"], bst: 534, weightkg: 110 },
    Gatomon: { types: ["Fairy", "Electric"], bst: 520, weightkg: 9.5 },
    Greymon: { types: ["Fire", "Dragon"], bst: 534, weightkg: 450 },
    Kabuterimon: { types: ["Bug", "Electric"], bst: 525, weightkg: 180 },
    Togemon: { types: ["Grass", "Fighting"], bst: 515, weightkg: 80 },
  };
  for (const definition of customBattleSpecies) {
    const species = Dex.species.get(definition.name);
    assert.equal(species.exists, true);
    assert.deepEqual(species.types, expected[definition.name].types);
    assert.deepEqual(species.baseStats, definition.baseStats);
    assert.equal(species.bst, expected[definition.name].bst);
    assert.equal(species.weightkg, expected[definition.name].weightkg);
    assert.equal(species.spriteid, `digimon/${definition.id}`);
  }
  const customIds = new Set(customBattleSpecies.map(({ id }) => id));
  assert.equal(encounterPokemon.some(({ id }) => customIds.has(id)), false);
  assert.equal(pokemonCatalog.some(({ id }) => customIds.has(id)), false);
});

test("the trainer editor exposes the full Showdown sprite catalog and custom sprites", () => {
  assert.ok(trainerSprites.length >= 1_400);
  for (const id of ["brock", "misty", "cynthia", "red", "youngster-gen9", "ramsay", "diya", "tai"]) {
    assert.ok(trainerSprites.some((sprite) => sprite.id === id), `missing trainer sprite ${id}`);
  }
  assert.equal(trainerSprites.find((sprite) => sprite.id === "ramsay")?.name, "Ramsay");
  assert.equal(trainerSprites.find((sprite) => sprite.id === "diya")?.name, "Diya");
  assert.equal(trainerSprites.find((sprite) => sprite.id === "tai")?.name, "Tai");
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

test("the November 15 live swap updates scouting and new battles without changing an existing battle snapshot", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nuzzle-live-trainer-"));
  let now = new Date("2026-11-14T15:00:00Z");
  const store = new TrainerStore(path.join(directory, "trainers.json"), { now: () => now });
  await store.initialize();
  await store.current();
  await store.add({
    name: "Live Trainer",
    spriteId: "brock",
    teamText: `Arboliva @ Leftovers
Ability: Seed Sower
- Giga Drain

Sudowoodo
Ability: Sturdy
- Rock Slide`,
  });

  now = new Date("2026-11-15T15:00:00Z");
  const beforeSwap = await store.current();
  const existingBattleTeam = structuredClone(beforeSwap.opponentTeam);

  assert.equal(await applyLiveTrainerAdjustments(store), true);
  const afterSwap = await store.current();
  assert.deepEqual(existingBattleTeam.map((set) => set.species), ["Arboliva", "Sudowoodo"]);
  assert.deepEqual(afterSwap.opponentTeam.map((set) => set.species), ["Vanilluxe", "Sudowoodo"]);

  const vanilluxe = afterSwap.opponentTeam[0];
  assert.equal(vanilluxe.item, "Focus Sash");
  assert.equal(vanilluxe.ability, "Snow Warning");
  assert.equal(vanilluxe.nature, "Quiet");
  assert.deepEqual(vanilluxe.evs, { hp: 252, atk: 4, def: 0, spa: 252, spd: 0, spe: 0 });
  assert.deepEqual(vanilluxe.moves, ["Blizzard", "Freeze-Dry", "Ice Shard", "Aurora Veil"]);
  assert.equal(await applyLiveTrainerAdjustments(store), false, "the adjustment must be safe to run again after a restart");
});

test("the November 17 live adjustment removes trainer investments without changing existing battle snapshots", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nuzzle-live-stats-"));
  let now = new Date("2026-11-16T15:00:00Z");
  const store = new TrainerStore(path.join(directory, "trainers.json"), { now: () => now });
  await store.initialize();
  await store.current();
  await store.add({
    name: "Invested Trainer",
    spriteId: "brock",
    teamText: `Starmie @ Leftovers
Ability: Natural Cure
EVs: 4 HP / 252 SpA / 252 Spe
IVs: 0 Atk
Timid Nature
- Surf
- Psychic
- Ice Beam
- Recover`,
  });

  now = new Date("2026-11-17T15:00:00Z");
  const beforeAdjustment = await store.current();
  const existingBattleTeam = structuredClone(beforeAdjustment.opponentTeam);
  assert.equal("evs" in existingBattleTeam[0], true);
  assert.equal("ivs" in existingBattleTeam[0], true);
  assert.equal(existingBattleTeam[0].nature, "Timid");

  assert.equal(await applyLiveTrainerAdjustments(store), true);
  const afterAdjustment = await store.current();
  assert.equal(["evs", "ivs", "nature"].some((field) => field in afterAdjustment.opponentTeam[0]), false);
  assert.equal(existingBattleTeam[0].nature, "Timid", "an already-created battle keeps its original trainer snapshot");
  assert.equal(await applyLiveTrainerAdjustments(store), false, "the adjustment must be safe to run again after a restart");
});
