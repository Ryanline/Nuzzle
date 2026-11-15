import assert from "node:assert/strict";
import test from "node:test";
import { applyInfinightHypeRollback, infinightHypeRollback } from "../one-time-rollback.js";

test("the InfinightHype rollback selects only the matching dated forfeit", async () => {
  const record = {
    id: "forfeited-battle",
    userId: "infinight-user",
    challengeDate: infinightHypeRollback.date,
    createdAt: "2026-11-14T15:00:00.000Z",
    forfeited: true,
  };
  const calls = [];
  const result = await applyInfinightHypeRollback({
    auth: { identityById: (userId) => ({ id: userId, username: "InfinightHype" }) },
    service: {
      battles: new Map([[record.id, { record }]]),
      grantForfeitRollback: async (...values) => {
        calls.push(["battle", ...values]);
        return record.id;
      },
    },
    game: {
      restoreArchivedLoss: async (...values) => {
        calls.push(["game", ...values]);
        return { applied: true, state: { runId: "restored-run" } };
      },
    },
    logger: { info: () => {} },
  });
  assert.equal(result.applied, true);
  assert.deepEqual(calls, [
    ["battle", "infinight-user", infinightHypeRollback.date, infinightHypeRollback.key],
    ["game", "infinight-user", infinightHypeRollback.date, infinightHypeRollback.key],
  ]);
});

test("the InfinightHype rollback ignores every other account", async () => {
  const result = await applyInfinightHypeRollback({
    auth: { identityById: () => ({ username: "someone-else" }) },
    service: {
      battles: new Map([["forfeit", { record: { userId: "other", challengeDate: infinightHypeRollback.date, forfeited: true } }]]),
      grantForfeitRollback: () => assert.fail("The wrong battle was reset."),
    },
    game: { restoreArchivedLoss: () => assert.fail("The wrong run was restored.") },
  });
  assert.deepEqual(result, { applied: false, reason: "matching-forfeit-not-found" });
});
