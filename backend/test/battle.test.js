import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { acquisitionFromProtocol, BattleService } from "../battle-service.js";
import { BattleStore } from "../battle-store.js";
import { buildBrockTeam, buildPlayerTeam, PLAYER_IDS } from "../teams.js";

const defaultParty = ["flareon", "raichu", "vaporeon", "gengar", "venusaur", "pidgeot"];

async function serviceFixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nuzzle-battles-"));
  const service = new BattleService(new BattleStore(directory));
  await service.initialize();
  return { directory, service };
}

test("all PC Pokémon build with the agreed IV and EV spread", () => {
  for (const id of PLAYER_IDS) {
    const [set] = buildPlayerTeam([id], id);
    assert.equal(set.level, 100);
    assert.deepEqual(Object.values(set.ivs), [15, 15, 15, 15, 15, 15]);
    assert.deepEqual(Object.values(set.evs), [85, 85, 85, 85, 85, 85]);
    assert.equal(set.moves.length, 4);
  }
});

test("Brock has six itemless Pokémon with four moves each", () => {
  const team = buildBrockTeam();
  assert.deepEqual(team.map((set) => set.species), ["Steelix", "Golem", "Rhyperior", "Aerodactyl", "Sudowoodo", "Magcargo"]);
  for (const set of team) {
    assert.equal(set.item, "");
    assert.equal(set.moves.length, 4);
    assert.deepEqual(Object.values(set.ivs), [15, 15, 15, 15, 15, 15]);
    assert.deepEqual(Object.values(set.evs), [85, 85, 85, 85, 85, 85]);
  }
});

test("item-transfer protocol only records acquisitions by initially itemless player Pokémon", () => {
  const record = {
    partyIds: ["delphox", "scizor"],
    playerTeam: [
      { name: "Delphox", species: "Delphox", item: "" },
      { name: "Scizor", species: "Scizor", item: "Leftovers" },
    ],
  };
  assert.deepEqual(
    acquisitionFromProtocol("|-item|p1a: Delphox|Choice Specs|[from] ability: Magician|[of] p2a: Alakazam", record),
    { pokemonId: "delphox", itemId: "choicespecs", source: "ability: magician" }
  );
  assert.deepEqual(
    acquisitionFromProtocol("|-item|p1a: Delphox|Sticky Barb|[from] move: Trick", record),
    { pokemonId: "delphox", itemId: "stickybarb", source: "move: trick" }
  );
  assert.equal(acquisitionFromProtocol("|-item|p1a: Scizor|Choice Band|[from] move: Trick", record), null);
  assert.equal(acquisitionFromProtocol("|-item|p1a: Delphox|Sitrus Berry|[from] ability: Frisk", record), null);
});

test("Showdown advances a real turn and rejects stale choices", async () => {
  const { service } = await serviceFixture();
  const initial = await service.create({ partyIds: defaultParty, leadId: "vaporeon" });
  assert.equal(initial.player.active.id, "vaporeon");
  assert.equal(initial.opponent.active.id, "steelix");
  assert.equal(initial.moves.length, 4);
  assert.equal(initial.rqid, 1);

  const next = await service.get(initial.id).choose({ type: "move", slot: 1 }, initial.rqid);
  assert.ok(next.turn >= 2);
  assert.equal(next.moves[0].pp, initial.moves[0].pp - 1);
  assert.equal(next.rqid, 2);
  assert.match(next.events.join(" "), /used Surf/);
  assert.ok(next.log.some((entry) => entry.side === "opponent" && entry.category === "move"), "Brock's move was missing from the completed turn response.");
  assert.deepEqual(next.log.map((entry) => entry.id), [...next.log.map((entry) => entry.id)].sort((left, right) => left - right));
  await assert.rejects(
    service.get(initial.id).choose({ type: "move", slot: 1 }, initial.rqid),
    /earlier turn/
  );
});

test("a player can switch to any configured party member", async () => {
  const { service } = await serviceFixture();
  const initial = await service.create({
    partyIds: ["flareon", "arcanine", "lapras", "alakazam", "machamp", "exeggutor"],
    leadId: "flareon",
  });
  const next = await service.get(initial.id).choose({ type: "switch", slot: 6 }, initial.rqid);
  assert.equal(next.player.active.id, "exeggutor");
  assert.ok(next.turn >= 2);
});

test("a daily trainer and team are snapshotted into the battle", async () => {
  const { service } = await serviceFixture();
  const opponentTeam = [{ name: "Starmie", species: "Starmie", ability: "Natural Cure", level: 100, moves: ["Surf"] }];
  const state = await service.create({
    partyIds: ["vaporeon"],
    leadId: "vaporeon",
    opponentTeam,
    trainerName: "Misty",
    trainerSpriteId: "misty",
    challengeDate: "2026-10-23",
    challengeNumber: 9,
  });
  assert.equal(state.opponent.name, "Misty");
  assert.equal(state.opponent.spriteId, "misty");
  assert.equal(state.opponent.active.id, "starmie");
  assert.equal(state.challengeDate, "2026-10-23");
  assert.equal(state.challengeNumber, 9);
});

test("Zero to Hero exposes Palafin's transformed stats and sprite after switching out", async () => {
  const { service } = await serviceFixture();
  const playerTeam = [
    { name: "Palafin", species: "Palafin", ability: "Zero to Hero", level: 100, moves: ["Splash"] },
    { name: "Blissey", species: "Blissey", ability: "Natural Cure", level: 100, moves: ["Splash"] },
  ];
  const initial = await service.create({ partyIds: ["palafin", "blissey"], leadId: "palafin", playerTeam });
  const battle = service.get(initial.id);
  const zeroAttack = battle.stream.battle.p1.active[0].storedStats.atk;

  const benched = await battle.choose({ type: "switch", slot: 2 }, initial.rqid);
  const heroSlot = benched.player.team.find((pokemon) => pokemon.id === "palafinhero")?.slot;
  assert.ok(heroSlot, "Palafin-Hero should be available to switch back in.");
  const hero = await battle.choose({ type: "switch", slot: heroSlot }, benched.rqid);
  const heroAttack = battle.stream.battle.p1.active[0].storedStats.atk;

  assert.equal(hero.player.active.id, "palafinhero");
  assert.equal(hero.player.active.name, "Palafin-Hero");
  assert.equal(hero.player.active.spriteId, "palafin-hero");
  assert.ok(heroAttack > zeroAttack, `Hero Form attack (${heroAttack}) should exceed Zero Form attack (${zeroAttack}).`);
});

test("a saved battle replays to the same decision point", async () => {
  const { directory, service } = await serviceFixture();
  const initial = await service.create({ partyIds: defaultParty, leadId: "vaporeon" });
  const afterMove = await service.get(initial.id).choose({ type: "move", slot: 1 }, initial.rqid);

  const restoredService = new BattleService(new BattleStore(directory));
  await restoredService.initialize();
  const restored = restoredService.get(initial.id).state();
  assert.equal(restored.turn, afterMove.turn);
  assert.equal(restored.rqid, afterMove.rqid);
  assert.deepEqual(restored.player.team.map((pokemon) => pokemon.hp), afterMove.player.team.map((pokemon) => pokemon.hp));
  assert.deepEqual(restored.opponent.team.map((pokemon) => pokemon.percent), afterMove.opponent.team.map((pokemon) => pokemon.percent));
});

test("a saved battle belongs only to the account that created it", async () => {
  const { service } = await serviceFixture();
  const initial = await service.create({ partyIds: defaultParty, leadId: "vaporeon" }, "user-one");
  assert.equal(service.get(initial.id, "user-one").state().id, initial.id);
  assert.throws(() => service.get(initial.id, "user-two"), /not found/i);
});

test("daily attempts are limited to one and a reset survives restart", async () => {
  const { directory, service } = await serviceFixture();
  const challenge = { partyIds: defaultParty, leadId: "vaporeon", challengeDate: "2026-10-23", challengeNumber: 2 };
  await service.create(challenge, "daily-player");
  assert.equal(service.hasDailyAttempt("daily-player", "2026-10-23"), true);
  assert.equal(service.dailyBattle("daily-player", "2026-10-23")?.record.challengeNumber, 2);
  await assert.rejects(
    service.create(challenge, "daily-player"),
    (error) => error.statusCode === 409 && /already used/i.test(error.message)
  );
  await service.resetDailyAttempt("daily-player", "2026-10-23");
  assert.equal(service.hasDailyAttempt("daily-player", "2026-10-23"), false);
  assert.equal(service.dailyBattle("daily-player", "2026-10-23"), null);

  const restoredService = new BattleService(new BattleStore(directory));
  await restoredService.initialize();
  assert.equal(restoredService.hasDailyAttempt("daily-player", "2026-10-23"), false);
  await restoredService.create(challenge, "daily-player");
  await assert.rejects(restoredService.create(challenge, "daily-player"), /already used/i);
  await restoredService.create({ ...challenge, challengeDate: "2026-10-24", challengeNumber: 3 }, "daily-player");
});

test("forfeit produces a Brock win", async () => {
  const { service } = await serviceFixture();
  const initial = await service.create({ partyIds: defaultParty, leadId: "gengar" });
  const result = await service.get(initial.id).forfeit();
  assert.equal(result.ended, true);
  assert.equal(result.winner, "Brock");
  assert.equal(result.forfeited, true);
});

test("daily leaderboard ranks winners by survivors and then completion time", async () => {
  const { service } = await serviceFixture();
  const pokemon = (id, fainted) => ({ id, name: id, spriteId: id, fainted });
  const addBattle = ({ id, userId, winner, completedAt, fainted }) => service.battles.set(id, {
    record: { id, userId, challengeDate: "2026-10-24", completedAt, createdAt: completedAt },
    state: () => ({
      ended: true,
      winner,
      player: { team: Array.from({ length: 6 }, (_, index) => pokemon(`mon-${index}`, index < fainted)) },
    }),
  });
  addBattle({ id: "later-clean", userId: "clean", winner: "Player", completedAt: "2026-10-24T15:00:00.000Z", fainted: 0 });
  addBattle({ id: "early-clean", userId: "early", winner: "Player", completedAt: "2026-10-24T14:00:00.000Z", fainted: 0 });
  addBattle({ id: "one-loss", userId: "one", winner: "Player", completedAt: "2026-10-24T13:00:00.000Z", fainted: 1 });
  addBattle({ id: "defeat", userId: "lost", winner: "Brock", completedAt: "2026-10-24T12:00:00.000Z", fainted: 6 });
  const usernames = { clean: "Clean", early: "Early", one: "One", lost: "Lost" };
  const entries = service.dailyLeaderboard("2026-10-24", (id) => ({ username: usernames[id] }));
  assert.deepEqual(entries.map(({ rank, username, fainted }) => ({ rank, username, fainted })), [
    { rank: 1, username: "Early", fainted: 0 },
    { rank: 2, username: "Clean", fainted: 0 },
    { rank: 3, username: "One", fainted: 1 },
    { rank: 4, username: "Lost", fainted: 6 },
  ]);
  assert.equal(entries[0].team.length, 6);
});

test("streak leaderboard counts consecutive wins ending today", async () => {
  const { service } = await serviceFixture();
  const addBattle = ({ id, userId, date, winner = "Player", completedAt }) => service.battles.set(id, {
    record: { id, userId, challengeDate: date, completedAt, createdAt: completedAt },
    state: () => ({ ended: true, winner, player: { team: [] } }),
  });
  addBattle({ id: "alpha-22", userId: "alpha", date: "2026-10-22", completedAt: "2026-10-22T14:00:00.000Z" });
  addBattle({ id: "alpha-23", userId: "alpha", date: "2026-10-23", completedAt: "2026-10-23T14:00:00.000Z" });
  addBattle({ id: "alpha-24", userId: "alpha", date: "2026-10-24", completedAt: "2026-10-24T15:00:00.000Z" });
  addBattle({ id: "beta-23", userId: "beta", date: "2026-10-23", completedAt: "2026-10-23T13:00:00.000Z" });
  addBattle({ id: "beta-24", userId: "beta", date: "2026-10-24", completedAt: "2026-10-24T14:00:00.000Z" });
  addBattle({ id: "missed-22", userId: "missed", date: "2026-10-22", completedAt: "2026-10-22T12:00:00.000Z" });
  addBattle({ id: "missed-24", userId: "missed", date: "2026-10-24", completedAt: "2026-10-24T13:00:00.000Z" });
  addBattle({ id: "lost-23", userId: "lost", date: "2026-10-23", completedAt: "2026-10-23T12:00:00.000Z" });
  addBattle({ id: "lost-24", userId: "lost", date: "2026-10-24", winner: "Brock", completedAt: "2026-10-24T12:30:00.000Z" });
  const entries = service.streakLeaderboard("2026-10-24", (id) => ({ username: id }));
  assert.deepEqual(entries.map(({ rank, username, streak }) => ({ rank, username, streak })), [
    { rank: 1, username: "alpha", streak: 3 },
    { rank: 2, username: "beta", streak: 2 },
    { rank: 3, username: "missed", streak: 1 },
    { rank: 4, username: "lost", streak: 0 },
  ]);
});

test("a six-on-six battle can be played through to a real result", async () => {
  const { directory, service } = await serviceFixture();
  let state = await service.create({
    partyIds: ["vaporeon", "machamp", "venusaur", "lapras", "nidoking", "alakazam"],
    leadId: "vaporeon",
  });
  const battle = service.get(state.id);
  for (let decisions = 0; !state.ended && decisions < 200; decisions++) {
    if (state.forcedSwitch) {
      const replacement = state.player.team.find((pokemon) => pokemon.canSwitch);
      assert.ok(replacement, "A forced switch did not offer a living replacement.");
      state = await battle.choose({ type: "switch", slot: replacement.slot }, state.rqid);
    } else {
      const move = [...state.moves].filter((candidate) => !candidate.disabled).sort((left, right) => (right.power || 0) - (left.power || 0))[0];
      assert.ok(move, "A normal turn did not offer a legal move.");
      state = await battle.choose({ type: "move", slot: move.slot }, state.rqid);
    }
  }
  assert.equal(state.ended, true, "The battle did not finish within 200 player decisions.");
  assert.ok(["Player", "Brock"].includes(state.winner));
  assert.ok(state.knockouts.length >= 6, "The result did not record the battle's knockouts.");
  assert.ok(state.knockouts.some((knockout) => knockout.credited), "No knockout was attributed to the Pokémon that caused it.");
  assert.ok(state.knockouts.every((knockout) => ["player", "opponent"].includes(knockout.defeated.side)));
  assert.ok(battle.record.choices.p2.every((choice) => choice.startsWith("move ") || choice.startsWith("switch ")));

  const restoredService = new BattleService(new BattleStore(directory));
  await restoredService.initialize();
  assert.deepEqual(restoredService.get(state.id).state().knockouts, state.knockouts);
});
