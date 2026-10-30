import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { dailyDiscordRecap, discordRecapPayload, DiscordRecapScheduler } from "../discord-recap.js";

function knockout(name, side = "opponent") {
  return {
    defeated: { side: "player", name: "Victim" },
    credited: side ? { side, id: name.toLowerCase(), name, spriteId: name.toLowerCase() } : null,
  };
}

function battle({ id, winner, lead, fainted, knockouts = [], date = "2026-10-30" }) {
  return {
    record: {
      id,
      userId: id,
      challengeDate: date,
      challengeNumber: 4,
      trainerName: "Maylene",
      trainerSpriteId: "maylene",
      playerTeam: [{ species: lead }],
    },
    state: () => ({
      ended: true,
      winner,
      opponent: { name: "Maylene", spriteId: "maylene" },
      player: { team: fainted.map((value, index) => index === 0
        ? { id: lead.toLowerCase(), name: lead, spriteId: lead.toLowerCase(), fainted: value }
        : { id: `${id}-support-${index}`, name: `${id} Support ${index}`, spriteId: "ditto", fainted: value }) },
      knockouts,
      challengeNumber: 4,
    }),
  };
}

function recapService() {
  return {
    battles: new Map([
      ["win", battle({ id: "win", winner: "Player", lead: "Crobat", fainted: [false, false] })],
      ["loss-one", battle({ id: "loss-one", winner: "Maylene", lead: "Crobat", fainted: [true, true], knockouts: [knockout("Lucario"), knockout("Lucario")] })],
      ["loss-two", battle({ id: "loss-two", winner: "Maylene", lead: "Gengar", fainted: [true, true], knockouts: [knockout("Lucario"), knockout("Machamp"), knockout("Hazard", null)] })],
    ]),
  };
}

test("daily Discord recaps aggregate trainer results, KOs, survivors, and users", () => {
  const recap = dailyDiscordRecap(recapService(), "2026-10-30", (id) => ({ username: id === "win" ? "Emerl" : id }));
  assert.deepEqual(recap, {
    date: "2026-10-30",
    challengeNumber: 4,
    trainerName: "Maylene",
    trainerSpriteId: "maylene",
    challengers: 3,
    playerWins: 1,
    trainerWins: 2,
    trainerWinPercent: 67,
    deadliestPokemon: { id: "lucario", name: "Lucario", spriteId: "lucario", kos: 3 },
    averageSurvivors: 2,
    flawlessWins: 1,
    flawlessWinners: ["Emerl"],
  });
  const payload = discordRecapPayload(recap, { publicUrl: "https://nuzzle.example/" });
  assert.equal(payload.allowed_mentions.parse.length, 0);
  assert.equal(payload.embeds[0].title, "Nuzzle #4 Daily Report");
  assert.equal(payload.embeds[0].color, 0xc28e4a);
  assert.match(payload.embeds[0].description, /Maylene.*67%.*3 challengers.*1 player won and 2 lost/);
  assert.match(payload.embeds[0].description, /deadliest Pokémon.*Lucario.*3.*player Pokémon/);
  assert.equal(payload.embeds[0].thumbnail.url, "https://nuzzle.example/assets/showdown/trainers/maylene.png");
  assert.equal(payload.embeds[0].image.url, "https://nuzzle.example/assets/showdown/gen5/lucario.png");
  assert.equal(payload.embeds.length, 1);
  assert.match(payload.embeds[0].description, /2\.0 survivors/);
  assert.match(payload.embeds[0].description, /1.*victory was flawless.*Emerl.*🏆/);
  assert.doesNotMatch(payload.embeds[0].description, /most popular/);
  assert.equal(payload.embeds[0].footer.text, "October 30, 2026");
  assert.equal(JSON.stringify(payload).includes("—"), false);
});

test("the Discord recap scheduler posts the previous day only once across restarts", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nuzzle-discord-"));
  const filename = path.join(directory, "discord-recaps.json");
  const requests = [];
  const options = {
    service: recapService(),
    filename,
    webhookUrl: "https://discord.example/webhook",
    now: () => new Date("2026-10-31T16:00:00.000Z"),
    fetchImpl: async (url, request) => {
      requests.push({ url, request });
      return { ok: true, status: 204 };
    },
    userById: (id) => ({ username: id }),
  };
  const scheduler = new DiscordRecapScheduler(options);
  await scheduler.initialize();
  assert.equal(await scheduler.postPreviousDay(), true);
  assert.deepEqual(scheduler.status(), { enabled: true, lastPostedDate: "2026-10-30" });
  assert.equal(await scheduler.postPreviousDay(), false);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, options.webhookUrl);
  assert.match(requests[0].request.headers["Content-Type"], /json/);
  assert.equal(JSON.parse(requests[0].request.body).embeds[0].title, "Nuzzle #4 Daily Report");

  const restored = new DiscordRecapScheduler(options);
  await restored.initialize();
  assert.equal(await restored.postPreviousDay(), false);
  assert.equal(requests.length, 1);
});

test("a failed Discord webhook is retried and never marked as posted", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nuzzle-discord-failure-"));
  let requests = 0;
  const scheduler = new DiscordRecapScheduler({
    service: recapService(),
    filename: path.join(directory, "discord-recaps.json"),
    webhookUrl: "https://discord.example/webhook",
    now: () => new Date("2026-10-31T16:00:00.000Z"),
    fetchImpl: async () => ({ ok: ++requests > 1, status: requests > 1 ? 204 : 500 }),
  });
  await scheduler.initialize();
  await assert.rejects(scheduler.postPreviousDay(), /returned 500/);
  assert.equal(await scheduler.postPreviousDay(), true);
  assert.equal(requests, 2);
});
