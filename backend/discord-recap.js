import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultTimeZone, gameDate, previousGameDate } from "./game-clock.js";

function completedBattles(service, date) {
  return [...service.battles.values()]
    .filter((battle) => battle.record.challengeDate === date && !battle.record.dailyAttemptReset)
    .map((battle) => ({ battle, state: battle.state() }))
    .filter(({ state }) => state.ended);
}

function mostCommon(values) {
  const counts = new Map();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([name, count]) => ({ name, count }))[0] || null;
}

export function dailyDiscordRecap(service, date) {
  const attempts = completedBattles(service, date);
  const first = attempts[0];
  const trainerName = first?.battle.record.trainerName || first?.state.opponent.name || "Today's trainer";
  const trainerSpriteId = first?.battle.record.trainerSpriteId || first?.state.opponent.spriteId || null;
  const challengeNumber = first?.battle.record.challengeNumber || first?.state.challengeNumber || null;
  const playerWins = attempts.filter(({ state }) => state.winner === "Player");
  const trainerWins = attempts.length - playerWins.length;
  const opponentKos = attempts.flatMap(({ state }) => state.knockouts)
    .filter((knockout) => knockout.defeated?.side === "player" && knockout.credited?.side === "opponent")
    .map((knockout) => knockout.credited);
  const koCounts = new Map();
  for (const pokemon of opponentKos) {
    const id = pokemon.id || pokemon.name;
    const current = koCounts.get(id) || { id, name: pokemon.name || pokemon.nickname || id, spriteId: pokemon.spriteId || id, kos: 0 };
    current.kos += 1;
    koCounts.set(id, current);
  }
  const deadliestPokemon = [...koCounts.values()].sort((left, right) => right.kos - left.kos || left.name.localeCompare(right.name))[0] || null;
  const survivorCounts = playerWins.map(({ state }) => state.player.team.filter((pokemon) => !pokemon.fainted).length);
  const flawlessWins = playerWins.filter(({ state }) => state.player.team.length > 0 && state.player.team.every((pokemon) => !pokemon.fainted)).length;
  const popularLead = mostCommon(attempts.map(({ battle }) => battle.record.playerTeam?.[0]?.species || battle.record.playerTeam?.[0]?.name));
  return {
    date,
    challengeNumber,
    trainerName,
    trainerSpriteId,
    challengers: attempts.length,
    playerWins: playerWins.length,
    trainerWins,
    trainerWinPercent: attempts.length ? Math.round(trainerWins / attempts.length * 100) : 0,
    deadliestPokemon,
    averageSurvivors: survivorCounts.length ? survivorCounts.reduce((sum, value) => sum + value, 0) / survivorCounts.length : null,
    flawlessWins,
    popularLead,
  };
}

function plural(value, singular, pluralValue = `${singular}s`) {
  return value === 1 ? singular : pluralValue;
}

function publicAssetUrl(publicUrl, relative) {
  return `${String(publicUrl || "").replace(/\/+$/, "")}/${relative.split("/").map(encodeURIComponent).join("/")}`;
}

export function discordRecapPayload(recap, { publicUrl = "https://nuzzle-game.duckdns.org" } = {}) {
  const title = recap.challengeNumber ? `Daily Recap — Nuzzle #${recap.challengeNumber}` : "Daily Nuzzle Recap";
  const trainerSprite = recap.trainerSpriteId
    ? publicAssetUrl(publicUrl, recap.trainerSpriteId === "brock" ? "assets/trainers/brock.png" : `assets/showdown/trainers/${recap.trainerSpriteId}.png`)
    : null;
  const deadliestSprite = recap.deadliestPokemon?.spriteId
    ? publicAssetUrl(publicUrl, `assets/showdown/gen5/${recap.deadliestPokemon.spriteId}.png`)
    : null;
  if (!recap.challengers) {
    return {
      username: "Nuzzle",
      allowed_mentions: { parse: [] },
      embeds: [{
        title,
        description: `No challengers completed the battle against **${recap.trainerName}**.`,
        color: 0x52606e,
        ...(trainerSprite ? { thumbnail: { url: trainerSprite } } : {}),
        footer: { text: recap.date },
      }],
    };
  }
  const deadliest = recap.deadliestPokemon
    ? `**${recap.deadliestPokemon.name}** knocked out **${recap.deadliestPokemon.kos} ${plural(recap.deadliestPokemon.kos, "Pokémon", "Pokémon")}**.`
    : "No knockouts were attributed to the trainer's Pokémon.";
  const survival = recap.playerWins
    ? `Winning teams escaped with an average of **${recap.averageSurvivors.toFixed(1)} survivors**. **${recap.flawlessWins}** ${plural(recap.flawlessWins, "victory", "victories")} ${recap.flawlessWins === 1 ? "was" : "were"} flawless.`
    : `No challenger defeated **${recap.trainerName}**.`;
  const fields = [
    { name: "Deadliest Pokémon", value: deadliest },
    { name: "Survival report", value: survival },
  ];
  if (recap.popularLead) fields.push({
    name: "Most popular lead",
    value: `**${recap.popularLead.name}** led **${recap.popularLead.count} ${plural(recap.popularLead.count, "team")}** into battle.`,
  });
  return {
    username: "Nuzzle",
    allowed_mentions: { parse: [] },
    embeds: [{
      title,
      description: `**${recap.trainerName}** defeated **${recap.trainerWinPercent}% of ${recap.challengers} ${plural(recap.challengers, "challenger")}** — ${recap.trainerWins} trainer ${plural(recap.trainerWins, "win")} and ${recap.playerWins} player ${plural(recap.playerWins, "win")}.`,
      color: 0x8d3035,
      fields,
      ...(trainerSprite ? { thumbnail: { url: trainerSprite } } : {}),
      ...(deadliestSprite ? { image: { url: deadliestSprite } } : {}),
      footer: { text: recap.date },
    }],
  };
}

export class DiscordRecapScheduler {
  constructor({
    service,
    filename,
    webhookUrl = "",
    timeZone = defaultTimeZone,
    now = () => new Date(),
    fetchImpl = globalThis.fetch,
    publicUrl = "https://nuzzle-game.duckdns.org",
    intervalMs = 60_000,
    logger = console,
  }) {
    this.service = service;
    this.filename = filename;
    this.webhookUrl = String(webhookUrl || "").trim();
    this.timeZone = timeZone;
    this.now = now;
    this.fetchImpl = fetchImpl;
    this.publicUrl = publicUrl;
    this.intervalMs = intervalMs;
    this.logger = logger;
    this.data = { version: 1, posted: {} };
    this.timer = null;
    this.running = null;
    this.writeSequence = 0;
  }

  async initialize() {
    await mkdir(path.dirname(this.filename), { recursive: true });
    try {
      const stored = JSON.parse(await readFile(this.filename, "utf8"));
      if (stored?.posted && typeof stored.posted === "object") this.data = { version: 1, posted: { ...stored.posted } };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  async save() {
    const temporary = `${this.filename}.${process.pid}.${++this.writeSequence}.tmp`;
    await writeFile(temporary, `${JSON.stringify(this.data, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, this.filename);
  }

  async postPreviousDay() {
    if (!this.webhookUrl) return false;
    if (this.running) return this.running;
    this.running = (async () => {
      const date = previousGameDate(gameDate(this.now(), this.timeZone));
      if (this.data.posted[date]) return false;
      const recap = dailyDiscordRecap(this.service, date);
      const response = await this.fetchImpl(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(discordRecapPayload(recap, { publicUrl: this.publicUrl })),
      });
      if (!response.ok) throw new Error(`Discord recap webhook returned ${response.status}.`);
      this.data.posted[date] = this.now().toISOString();
      await this.save();
      return true;
    })();
    try {
      return await this.running;
    } finally {
      this.running = null;
    }
  }

  start() {
    if (!this.webhookUrl || this.timer) return;
    const post = () => this.postPreviousDay().catch((error) => this.logger.error("Discord daily recap failed:", error));
    void post();
    this.timer = setInterval(post, this.intervalMs);
    this.timer.unref?.();
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }
}
