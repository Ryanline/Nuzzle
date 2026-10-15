import { describe, expect, it } from "vitest";
import { InteractiveBattleStore } from "../server/showdown/interactive-battle.js";

describe("interactive battle", () => {
  it("accepts a player move and advances to the next choice", async () => {
    const store = new InteractiveBattleStore();
    const initial = await store.create({
      party: [{ speciesId: "blastoise", moves: ["surf", "icebeam", "flashcannon", "protect"] }],
      leadId: "blastoise",
      trainerTier: "regular",
    });

    expect(initial.player.species).toBe("Blastoise");
    expect(initial.opponent.species).toBe("Gengar");
    expect(initial.request.moves).toHaveLength(4);

    const next = await store.get(initial.id).choose("move 1");

    expect(Number(next.turn)).toBeGreaterThanOrEqual(2);
    expect(next.log.some((line) => line.includes("|move|p1a: Blastoise|Surf|"))).toBe(true);
  });
});
