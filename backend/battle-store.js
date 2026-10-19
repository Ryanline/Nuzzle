import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export class BattleStore {
  constructor(directory) {
    this.directory = directory;
    this.pendingWrite = Promise.resolve();
    this.writeSequence = 0;
  }

  async initialize() {
    await mkdir(this.directory, { recursive: true });
  }

  async save(record) {
    const sequence = ++this.writeSequence;
    this.pendingWrite = this.pendingWrite.then(async () => {
      await this.initialize();
      const destination = path.join(this.directory, `${record.id}.json`);
      const temporary = `${destination}.${process.pid}.${sequence}.tmp`;
      await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, "utf8");
      await rename(temporary, destination);
    });
    return this.pendingWrite;
  }

  async loadAll() {
    await this.initialize();
    const names = await readdir(this.directory);
    const records = [];
    for (const name of names.filter((entry) => entry.endsWith(".json"))) {
      try {
        records.push(JSON.parse(await readFile(path.join(this.directory, name), "utf8")));
      } catch (error) {
        console.error(`Could not restore ${name}:`, error);
      }
    }
    return records;
  }
}
