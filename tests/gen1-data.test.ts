import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

describe("Gen 1 encounter data", () => {
  it("contains every non-legendary Kanto species", () => {
    const context = { window: {} as { NUZZLE_DATA?: { species: Array<{ id: string; number: number; moves: unknown[] }> } } };
    runInNewContext(readFileSync("dist/game-data.js", "utf8"), context);
    const species = context.window.NUZZLE_DATA?.species || [];
    const ids = new Set(species.map((mon) => mon.id));

    expect(species).toHaveLength(146);
    expect(species.every((mon) => mon.number >= 1 && mon.number <= 151 && mon.moves.length > 0)).toBe(true);
    expect(["articuno", "zapdos", "moltres", "mewtwo", "mew"].some((id) => ids.has(id))).toBe(false);
  });
});
