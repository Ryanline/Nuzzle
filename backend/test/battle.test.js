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

test("non-admin accounts get one daily battle attempt while admins can repeat", async () => {
  const { directory, service } = await serviceFixture();
  const challenge = { partyIds: defaultParty, leadId: "vaporeon", challengeDate: "2026-10-23", challengeNumber: 2 };
  await service.create(challenge, "daily-player");
  assert.equal(service.hasDailyAttempt("daily-player", "2026-10-23"), true);
  await assert.rejects(
    service.create(challenge, "daily-player"),
    (error) => error.statusCode === 409 && /already used/i.test(error.message)
  );
  await service.create(challenge, "daily-player", { allowRepeat: true });
  await service.create({ ...challenge, challengeDate: "2026-10-24", challengeNumber: 3 }, "daily-player");

  const restoredService = new BattleService(new BattleStore(directory));
  await restoredService.initialize();
  assert.equal(restoredService.hasDailyAttempt("daily-player", "2026-10-23"), true);
  await assert.rejects(restoredService.create(challenge, "daily-player"), /already used/i);
});

test("forfeit produces a Brock win", async () => {
  const { service } = await serviceFixture();
  const initial = await service.create({ partyIds: defaultParty, leadId: "gengar" });
  const result = await service.get(initial.id).forfeit();
  assert.equal(result.ended, true);
  assert.equal(result.winner, "Brock");
  assert.equal(result.forfeited, true);
});

test("a six-on-six battle can be played through to a real result", async () => {
  const { service } = await serviceFixture();
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
  assert.ok(battle.record.choices.p2.every((choice) => choice.startsWith("move ") || choice.startsWith("switch ")));
});
