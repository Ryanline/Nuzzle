export const infinightHypeRollback = Object.freeze({
  key: "infinighthype-forfeit-2026-11-14",
  username: "infinighthype",
  date: "2026-11-14",
});

export async function applyInfinightHypeRollback({ auth, game, service, logger = console }) {
  const rollback = infinightHypeRollback;
  const battle = [...service.battles.values()]
    .filter((candidate) => {
      const identity = auth.identityById(candidate.record.userId);
      return identity?.username?.toLowerCase() === rollback.username
        && candidate.record.challengeDate === rollback.date
        && candidate.record.forfeited
        && (!candidate.record.dailyAttemptReset || candidate.record.oneTimeRollbackKey === rollback.key);
    })
    .sort((left, right) => String(right.record.createdAt).localeCompare(String(left.record.createdAt)))[0];
  if (!battle) return { applied: false, reason: "matching-forfeit-not-found" };

  const battleId = await service.grantForfeitRollback(battle.record.userId, rollback.date, rollback.key);
  if (!battleId) return { applied: false, reason: "matching-forfeit-not-found" };
  const restoration = await game.restoreArchivedLoss(battle.record.userId, rollback.date, rollback.key);
  if (restoration.applied) logger.info(`Applied one-time forfeit rollback ${rollback.key} for ${battle.record.userId}.`);
  return { applied: restoration.applied, battleId, state: restoration.state };
}
