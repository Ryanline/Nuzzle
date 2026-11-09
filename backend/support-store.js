import { appendFile, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzip } from "node:zlib";
import { promisify } from "node:util";
import { gameDate } from "./game-clock.js";

const gzipAsync = promisify(gzip);

function shiftDate(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export class SupportStore {
  constructor(directory, {
    retentionDays = 30,
    timeZone = process.env.NUZZLE_TIME_ZONE || "America/New_York",
    now = () => new Date(),
  } = {}) {
    this.directory = directory;
    this.eventDirectory = path.join(directory, "events");
    this.snapshotDirectory = path.join(directory, "snapshots");
    this.retentionDays = retentionDays;
    this.timeZone = timeZone;
    this.now = now;
    this.eventIds = new Set();
    this.snapshotDates = new Set();
    this.pending = Promise.resolve();
    this.lastCleanupDate = null;
  }

  async initialize() {
    await mkdir(this.eventDirectory, { recursive: true });
    await mkdir(this.snapshotDirectory, { recursive: true });
    for (const name of await readdir(this.eventDirectory)) {
      if (!name.endsWith(".jsonl")) continue;
      const lines = (await readFile(path.join(this.eventDirectory, name), "utf8")).split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          if (event.id) this.eventIds.add(event.id);
        } catch (error) {
          console.error(`Could not read support event from ${name}:`, error);
        }
      }
    }
    for (const name of await readdir(this.snapshotDirectory)) {
      if (name.endsWith(".json.gz")) this.snapshotDates.add(name.slice(0, 10));
    }
    await this.cleanup(gameDate(this.now(), this.timeZone));
  }

  async cleanup(date) {
    if (this.lastCleanupDate === date) return;
    const oldest = shiftDate(date, -this.retentionDays);
    for (const [directory, suffix] of [[this.eventDirectory, ".jsonl"], [this.snapshotDirectory, ".json.gz"]]) {
      for (const name of await readdir(directory)) {
        if (!name.endsWith(suffix) || name.slice(0, 10) >= oldest) continue;
        await unlink(path.join(directory, name)).catch((error) => {
          if (error.code !== "ENOENT") console.error(`Could not remove expired support record ${name}:`, error);
        });
        if (suffix === ".json.gz") this.snapshotDates.delete(name.slice(0, 10));
      }
    }
    this.lastCleanupDate = date;
  }

  async record(event) {
    let recorded = false;
    this.pending = this.pending.catch(() => {}).then(async () => {
      if (event.id && this.eventIds.has(event.id)) return;
      const now = this.now();
      const date = event.gameDate || gameDate(now, this.timeZone);
      const currentDate = gameDate(now, this.timeZone);
      await this.cleanup(currentDate);
      if (date < shiftDate(currentDate, -this.retentionDays)) return;
      const entry = { version: 1, recordedAt: now.toISOString(), ...event, gameDate: date };
      await appendFile(path.join(this.eventDirectory, `${date}.jsonl`), `${JSON.stringify(entry)}\n`, { encoding: "utf8", mode: 0o600 });
      if (event.id) this.eventIds.add(event.id);
      recorded = true;
    });
    await this.pending;
    return recorded;
  }

  async snapshot(date, payload) {
    this.pending = this.pending.catch(() => {}).then(async () => {
      if (this.snapshotDates.has(date)) return;
      await this.cleanup(date);
      const destination = path.join(this.snapshotDirectory, `${date}.json.gz`);
      if ((await stat(destination).catch(() => null))?.isFile()) {
        this.snapshotDates.add(date);
        return;
      }
      const temporary = `${destination}.${process.pid}.tmp`;
      const record = { snapshotVersion: 1, gameDate: date, createdAt: this.now().toISOString(), ...payload };
      await writeFile(temporary, await gzipAsync(`${JSON.stringify(record)}\n`, { level: 9 }), { mode: 0o600 });
      await rename(temporary, destination);
      this.snapshotDates.add(date);
    });
    await this.pending;
  }
}
