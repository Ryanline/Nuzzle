import { describe, expect, it } from "vitest";
import { runFixtureBattle } from "../server/showdown/fixture-battle.js";

describe("Pokémon Showdown fixture", () => {
  it("completes a deterministic singles battle", async () => {
    const result = await runFixtureBattle();
    expect(result.formatId).toBe("gen9customgame");
    expect(result.winner).toBe("Player");
    expect(result.turns).toBeGreaterThan(0);
    expect(result.transcript.join("\n")).toContain("|win|Player");
  }, 15_000);
});

