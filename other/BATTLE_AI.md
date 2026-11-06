# Trainer Battle AI

This is the source of truth for the trainer AI implemented in `backend/battle-service.js`. Keep the document and implementation synchronized when the hierarchy changes.

## How to read the hierarchy

Check each step in order. At each step, ignore unusable or ineffective moves. If the step selects a move, stop. If no move qualifies—or a probability roll fails—continue to the next step. Randomly choose between equally qualified moves.

### Hierarchy at a glance

1. **Escape Perish Song** — Switch before the count reaches zero, subject to the Pursuit exception.
2. **Defend with priority** — Answer a faster player's possible KO with priority.
3. **Take a guaranteed KO while faster.**
4. **Use Pursuit for a switch KO.**
5. **Use Fake Out.**
6. **Use Protect for useful passive recovery or damage.**
7. **Take a potential KO while faster.**
8. **Use a fast pivot to escape a KO.**
9. **Heal or cleanse.**
10. **Set up.**
11. **Use a situational counter.**
12. **Use other status or arena control.**
13. **Use a slow pivot.**
14. **Deal damage or switch.**
15. **Fall back to a random legal move, switching rather than using Struggle when possible.**

“AI” means the trainer-side active Pokémon. “Player” means the user-side active Pokémon.

- **Can KO** means at least one non-critical damage roll can KO, assuming the move hits.
- **Guaranteed KO** means every non-critical damage roll can KO, assuming the move hits.
- **Usable** means the move can legally be selected, has PP, is not disabled or blocked by an effect such as Taunt, meets its special conditions, and is effective against the player's known current state.
- **Passive damage** means guaranteed ongoing damage such as poison, toxic poison, burn, Leech Seed, trapping, Salt Cure, Curse, or damaging weather.
- **Passive recovery** means guaranteed ongoing recovery such as Leftovers, Leech Seed recovery, Rain Dish, Ingrain, or Grassy Terrain.

Before comparing moves:

1. Ignore critical hits in incoming and outgoing calculations.
2. Assume the AI wins Speed ties.
3. Avoid known immunities and moves that are known to fail whenever another usable move exists.
4. Consider a charge move only when it will resolve in one turn, such as Solar Beam in sun or a compatible move with Power Herb. Otherwise, use it only as a last resort.
5. Self-damage from recoil, Life Orb, crash damage, stat drops, or similar costs does not lower a move's priority. The exception is an otherwise tied choice where one move would faint the AI and another would not; choose the move that preserves the AI.
6. When otherwise tied, prefer a move that raises the AI's future offensive power, including damaging setup such as Contrary Leaf Storm or Torch Song.
7. If same-tier choices remain tied, prefer the more accurate move. Accuracy does not affect KO probability or move priority before this tiebreaker.
8. If the choices are still tied, choose randomly.
9. Save every random choice with the battle action so replaying or reconnecting cannot reroll it.

## What the AI knows

The AI knows:

- The player's full team, movesets, stats, current PP, current types, stat stages, statuses, and field state.
- Its own team's complete information.
- A player ability or held item only after it has been observed or necessarily inferred.

An ability becomes known when it activates or when an observed result requires it. An item becomes known when it activates or when an observation could not otherwise have happened—for example, a Pokémon must be holding Choice Scarf to have moved first, or its damage requires Choice Band, Choice Specs, Life Orb, or another specific modifier. Do not infer an ability or item when several unknown explanations remain possible.

Until an ability or item is known, ignore it in decision calculations. Once known, remember it for the rest of the battle. Knowing information does not create a new strategy by itself; use it only where this hierarchy calls for it.

The AI never knows which action the player selected for the current turn.

## 1. Escape Perish Song

If the AI's Perish Song count will reach zero this turn, switch before considering anything else.

Exception: if the AI has Pursuit and Pursuit would KO the player if the player switched, use Pursuit instead. If switching is impossible, continue down the hierarchy.

Choose the replacement using the “next best teammate” rule under Slow Pivot.

## 2. Defend with priority

If the player is faster and has a move that can KO the AI, use a usable damaging priority move.

Sucker Punch is allowed here. If that Pokémon attempts Sucker Punch and it fails once, do not consider its Sucker Punch again for the rest of the battle.

## 3. Take a guaranteed KO while faster

If the AI moves before the player and has a guaranteed KO, use one of the qualifying moves.

## 4. Use Pursuit for a switch KO

If Pursuit can KO the player with its switch-triggered damage, use Pursuit.

If Pursuit does not get the KO, do not use it on the immediately following turn. A different move resets this restriction. If Pursuit gets the KO, it may be used again immediately against the incoming Pokémon if the new target also qualifies.

## 5. Use Fake Out

Use Fake Out when it is legal, deals damage, and its flinch is not blocked by a known ability or item.

Calculate its actual effectiveness after current type changes and the AI's own effects. It may be used against a Ghost when Scrappy bypasses the immunity, Pixilate or another effect changes its type, Soak or another effect changed the player's type, or any comparable known mechanic makes it effective.

Fake Out cannot be selected again until that Pokémon leaves the field and returns.

## 6. Use Protect for useful stall

Use Protect, Detect, or a comparable protection move when either side benefits the AI from spending the turn safely:

- The AI has passive recovery.
- The player is guaranteed to take passive damage.

Do not use a protection move on consecutive turns.

## 7. Take a potential KO while faster

If the AI moves before the player and has a move whose damage range can KO, use one of the qualifying moves. Prefer the move with the greatest KO chance based on its non-critical damage rolls alone. Do not include accuracy in that probability; use accuracy only if the moves remain tied under the normal same-tier tiebreakers.

## 8. Use a fast pivot to escape a KO

If the AI outspeeds the player, cannot KO the player, and the player can KO the AI, use a usable pivot move such as U-turn, Volt Switch, Flip Turn, Parting Shot, or Chilly Reception to bring in the next best teammate.

Use the “next best teammate” rule under Slow Pivot. If no pivot can complete its switching effect or no teammate can legally switch in, continue to Heal or Cleanse.

## 9. Heal or cleanse

### Receive a pending Wish

On the turn after the AI uses Wish, first look for a damaged teammate that can receive it safely. A teammate qualifies when:

- The player cannot KO that teammate from its current HP.
- The player's strongest known move cannot deal more than 50% of that teammate's maximum HP.

If one or more teammates qualify, switch to one so it receives Wish. Choose randomly among the qualifying recipients.

If no teammate qualifies, use Protect, Detect, Baneful Bunker, or another usable protection move so the active AI can receive Wish, but only when the player has no setup move such as Dragon Dance, Swords Dance, Substitute, or a comparable boosting opportunity.

If neither follow-up is available, continue through this tier normally.

### Recover

Consider recovery only when the AI is at or below 50% HP and the player cannot KO through the AI's projected post-recovery HP.

- Base recovery chance: **50%**.
- Recovery chance while the player is taking passive damage: **100%**.
- Recovery chance when the field increases that move's healing: **100%**. Examples include sun boosting Morning Sun, Moonlight, or Synthesis and sand boosting Shore Up.

Recovery includes Wish, Recover, Roost, Milk Drink, Soft-Boiled, Slack Off, Morning Sun, Moonlight, Synthesis, Shore Up, Strength Sap, Rest, and comparable healing moves. Wish is considered under the same HP threshold and probability rules as other recovery. Because Wish heals later, it is eligible only when the player cannot KO the active AI on the turn Wish is used. Recovery is repeatable and is not treated as ordinary status setup.

If the recovery roll fails, continue down the hierarchy. Do not reconsider the same recovery move as ordinary status on that turn.

### Cleanse

If the AI or another living teammate has a major status and the AI has Heal Bell, Aromatherapy, or another team cleanse, use it. If the active AI has a major status and has Refresh or another self-cleanse, use it.

## 10. Set up

If the player cannot KO the AI, consider a move that raises the AI's stats or offensive power. Damaging moves with a beneficial effect, such as Contrary Leaf Storm, belong here and may also qualify in KO or Damage tiers.

The chance falls with consecutive setup actions by the same Pokémon:

| Consecutive setup action | Chance |
| ---: | ---: |
| First | 100% |
| Second | 75% |
| Third | 50% |
| Fourth | 25% |
| Fifth or later | 0% |

Using a non-setup move or leaving the field resets the sequence. Do not use setup when its relevant boosts are already maximized.

Treat Substitute as setup, but do not apply the diminishing consecutive-use chances. It is usable only when no Substitute is active and the AI has enough HP to create one.

Stop considering a Speed-only setup move, such as Agility, once the AI outspeeds every living player Pokémon. Until an opposing item is known, make this comparison conservatively by assuming the fastest relevant player Pokémon could have maximum speed investment and hold Choice Scarf. Do not apply this stopping rule to mixed setup such as Dragon Dance.

## 11. Use a situational counter

- If the player has Reflect, Light Screen, or Aurora Veil, use Brick Break, Psychic Fangs, Raging Bull, Defog, or another applicable screen remover.
- If the player has positive stat stages, use Haze, Clear Smog, or another applicable boost remover.
- If the player established the active terrain, use Ice Spinner, Steel Roller, Defog, or another applicable terrain remover.

Do not intentionally remove terrain established by the AI side. Track which side created it. This list may not be exhaustive, so apply the logic to other potential situational moves. Moves like venoshock or hex which are simply stronger against statused foes or the like should not be considered for this hierarchy-tier, but rather considered how any damaging move would be considered based on how much damage it would deal with the boost if the boost applies (i.e. if the player is poisoned and the AI has venoshock or hex available). 

## 12. Use other status or arena control

First consider an urgent response that can take effect before the threat:

- If the player has physical moves that can KO the AI, burn it or sharply reduce its Attack with Will-O-Wisp, Feather Dance, or a comparable move.
- If the player's Special Attack is increased by stages, an observed item, or another known effect, reduce its Special Attack with Captivate or a comparable move.
- If the player is faster than the active AI or another living AI teammate, reduce its Speed or paralyze it with Icy Wind, Nuzzle, Thunder Wave, or a comparable move.

Otherwise, consider the following useful, nonredundant moves evenly:

- Entry hazards.
- Reflect, Light Screen, and Aurora Veil while snow is active.
- Terrain and weather setters when their effect is not already active.
- Trick Room when it is not already active.
- Perish Song when the active Pokémon are not already under Perish Song.
- A move whose status or stat effect is guaranteed when it hits.
- Taunt, Encore, Disable, Counter, Mirror Coat, Destiny Bond, and comparable utility.

Do not try to refresh an active screen, weather, terrain, Trick Room, or Perish Song effect. Do not apply a major status to a player that already has one, and respect known type, ability, item, Substitute, Safeguard, terrain, and field restrictions.

Hazard-layer chances are:

| Layer being added | Chance |
| ---: | ---: |
| First | 100% |
| Second | 70% |
| Third | 40% |

Choose evenly among the eligible moves in this tier. If a stacked hazard is selected and its layer roll fails, remove it from consideration and choose among the remaining moves in this tier before moving down the hierarchy. For example, if second-layer Spikes loses its 70% roll while Reflect is also eligible, use Reflect.

If Taunt, Encore, Disable, Counter, Mirror Coat, or a comparable utility move fails, put that move on cooldown for two full battle turns. A successful Taunt, Encore, or Disable needs no further benefit check. Put Destiny Bond on cooldown only when it does not contribute to a KO by the end of the following turn.

## 13. Use a slow pivot

If the AI is slower and the player cannot KO it this turn, use Chilly Reception, U-turn, Volt Switch, Flip Turn, Parting Shot, or another usable pivot move to bring in the next best teammate.

The **next best teammate** is selected using only Speed and immediate one-hit damage:

1. If one or more legal teammates outspeed the player, choose the one that can deal the most damage in one hit.
2. If no legal teammate outspeeds the player, choose the legal teammate that can deal the most damage in one hit despite moving second.

Do not assign switching value to status, setup, recovery, or other utility. Choose randomly between teammates tied on Speed eligibility and one-hit damage.

## 14. Deal damage or switch

When the hierarchy reaches ordinary damage, first give the AI a **10% chance** to hard-switch to the next best teammate. Do not roll when the AI is trapped or has no legal teammate. If the switch roll fails, attack.

Find the shortest sequence of successful hits whose **minimum non-critical damage** is enough to KO the player. Any move that can begin one of those shortest guaranteed sequences is eligible.

This permits mixed but equally consistent lines. If Solar Beam twice is a guaranteed 2HKO and Solar Beam followed by Sludge Bomb is also a guaranteed 2HKO, either Solar Beam or Sludge Bomb may be selected as the first move when both can begin a valid two-hit line.

Start with guaranteed one-hit lines that were not selected earlier because the AI did not move first, then two-hit lines, then three-hit lines, and continue until something qualifies. Apply the universal same-tier tiebreakers, including self-preservation, offensive boosts, accuracy, and finally random selection.

## 15. Fall back

If nothing above selects an action, choose randomly from the remaining legal moves. Do not make another 10% switch roll here; the Damage tier already made it. If no move is legally selectable, switch when a legal switch exists. If switching is also impossible, allow Pokémon Showdown to use Struggle.

## Move memory and cooldowns

In addition to the tier-specific rules above:

- **Crash moves:** If High Jump Kick or another crash move is exploited by a player-side action—such as Protect, a deliberate switch into an immunity, or another known effect that causes crash damage—do not consider that move for the next two full battle turns. An ordinary accuracy miss against a player at neutral evasion does not trigger this cooldown.
- **Failed utility:** A failed Taunt, Encore, Disable, Counter, Mirror Coat, or comparable utility move receives the two-turn cooldown described in Other Status. A successful Taunt, Encore, or Disable counts as useful without further evaluation. Destiny Bond receives the cooldown only when it does not contribute to a KO by the end of the following turn.
- **Pursuit:** A Pursuit that does not KO is skipped on the immediately following turn.
- **Sucker Punch:** After one failed Sucker Punch attempt by a Pokémon, that Pokémon never considers it again during that battle.

## Implementation state to retain

The AI must retain or derive:

- Observed and necessarily inferred player abilities and items.
- Current PP, legal moves, disabled moves, move locks, and known failure conditions.
- Effective Speed, priority, current typing, stats, boosts, statuses, and damage ranges.
- Passive damage and recovery affecting either active Pokémon.
- Consecutive setup count for each AI Pokémon.
- The most recent Protect-family use.
- Hazard layers, screens, weather, terrain, Trick Room, Perish Song, and field ownership where relevant.
- Pursuit, Sucker Punch, failed utility, and crash-move memory.
- Living switch candidates, entry-hazard costs, and next-best-teammate scoring.

Update this document before or alongside any intentional hierarchy change. Name tests after the tier or interaction they protect so implementation can be checked directly against this specification.
