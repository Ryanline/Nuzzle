# Nuzzle — Canonical Game and Implementation Information

Last updated: October 20, 2026

This document is the current source of truth for owner-approved Nuzzle behavior. The curated Pokémon and item approvals live in [`../data/nuzzle-approvals.csv`](../data/nuzzle-approvals.csv). The older [`pokemon-daily-game-spec.md`](pokemon-daily-game-spec.md) remains useful for design history and detailed proposals, but this document wins wherever the two conflict.

Values explicitly marked **Open** or **Deferred** are not approved implementation decisions. Keep them configurable and do not silently choose permanent behavior.

## 1. Product

Nuzzle is a mobile-first daily Pokémon battle game. Every player faces the same opponent on a given game date but develops an individualized roster through encounters, training, items, and permanent casualties.

The intended experience is fast, restrained, and easy to understand:

- One consequential official singles battle per game date.
- A short battle with optional preparation beforehand.
- Persistent attachment to a run's Pokémon.
- Permanent death for Pokémon that faint in an official battle.
- A full run wipe after a battle loss.
- A calendar-driven monthly campaign ending with the Elite Four and Champion.
- No practice battle and no same-day retry.

## 2. Accounts and interface

- An account is required for tracked game sections. The landing page remains visible while logged out.
- Selecting a game section while logged out opens authentication and continues to the requested section after login.
- Local development uses username/password accounts, scrypt password hashes, 30-day HttpOnly same-site cookies, and ignored data beneath `backend/data/`.
- A profile defaults to a circular first-letter avatar. Users may upload, replace, or remove a profile picture.
- The per-device theme defaults to light and is remembered independently of login.
- Dark mode uses `#121212` as its main background.
- The Leaderboard is currently a “Coming soon” placeholder.
- Production account storage, recovery, deployment, backups, and stronger abuse controls remain future infrastructure work.

The established UI is mobile-first. Detailed information should appear on demand rather than crowding primary screens. Battle events use a contained scrollable log; its expanded state covers the command controls but leaves Give Up accessible.

## 3. Calendar and official battles

- Every game date has one shared opponent configuration for all players.
- Ordinary days use regular trainers.
- Fridays outside the month-end finale use Gym Leaders.
- The final five dates of every month are Elite Four 1, Elite Four 2, Elite Four 3, Elite Four 4, and Champion, in that order.
- The finale overrides a Friday Gym battle.
- Earlier wins or badges are not prerequisites for facing a later calendar opponent.
- A player joining late faces the current calendar opponent without opponent scaling or a special catch-up grant.
- A daily opponent must be generated and persisted once; it must not reroll per player or change after attempts begin.

**Open:** Global game timezone and the exact rollover policy, including battles active across rollover.

## 4. Runs, deaths, and streaks

A run contains the player's living roster, money, and combat inventory since the latest monthly reset or wipe.

### Winning

- Any player Pokémon that fainted during the official battle dies permanently.
- Boxed Pokémon are not endangered by an individual battle victory.
- Held-item ownership survives an individual holder's death after a win.
- Surviving Pokémon receive free full healing between battles.
- The player receives the configured rewards and extends the win streak.

### Losing or forfeiting

- The win streak ends.
- The entire party and box are lost.
- Run money and run items are lost.
- The cumulative wipe count increases.
- A fresh run is created.
- The player cannot attempt another official battle until the next game date.
- Losses grant no money.

### Missing a day

- Missing a game date breaks the win streak.
- There is no participation streak or participation reward.
- Missing a day does not currently imply a wipe.

### Monthly reset

- The roster and money reset on the first day of each month.
- A continuous win streak may cross the monthly boundary.
- Lifetime records such as wipes, badges, Elite Four wins, and Champion wins persist.

**Open:** Final monthly inventory-reset details and any future Champion carryover reward.

## 5. Encounters

- Ordinary dates provide three encounters.
- Sundays provide four encounters.
- Catching is guaranteed; there is no wild battle or capture roll.
- All encounter results are level 100.
- There is no leveling or evolution system.
- The approvals CSV is the explicit eligibility list. Do not infer eligibility from every species available in Showdown.
- Every approved species/form may be used by both players and trainers unless a later rule explicitly says otherwise.
- Generated encounters must be persisted before presentation. Refreshing cannot reroll them.

### Fresh runs and starter guarantees

- A fresh run begins with zero Pokémon, so its trainer battle is locked at first.
- Claiming the first encounter of a fresh run grants a batch of twelve Pokémon and automatically places the first six on the team. This opening batch consumes one of that date's ordinary encounter slots.
- The first result in that twelve-Pokémon batch is the guaranteed starter for the first-ever encounter, the first encounter of a new month, or the first encounter after a wipe.
- Overlapping conditions create one guarantee, not multiple guarantees.
- The guarantee is consumed only after the encounter is successfully generated and persisted.
- The guaranteed result is a fully evolved starter; there is no starter choice screen.
- Every eligible starter evolution has equal weight. Standard and regional evolutions are separate equal-probability results—for example, Typhlosion and Hisuian Typhlosion each receive the same chance as every other eligible starter evolution.
- Starters never appear in ordinary encounters, including Sundays.
- Guaranteed starters use the same stat, nature, ability, gender, and shiny generation rules as other encounters.

After the opening batch is claimed, its remaining daily encounter slots behave as ordinary single-Pokémon encounters.

### Duplicate prevention

- Duplicate checking covers the entire living owned roster: party plus PC box.
- Dead Pokémon may be encountered again.
- Results reserved within the same encounter batch count as owned before the next draw.
- Branch evolutions such as Poliwrath and Politoed are distinct.
- Regional forms are distinct unless a specific grouped-family rule says otherwise.
- A form-changing item does not change the Pokémon's duplicate-family identity.

## 6. Species and form identity

Content code must use stable canonical Showdown IDs. Display labels from the CSV must not be used as persistence keys, API identifiers, or sprite identifiers.

### Regional forms

Regional forms are separate Pokémon and separate encounter identities. Owning ordinary Raichu does not block Alolan Raichu, for example.

### Grouped persistent forms

Some form families have a combined encounter weight of `1`. If a family has `n` approved forms, each form normally has weight `1 / n`. Owning any member blocks all members of that family.

This policy applies to:

- Gourgeist sizes
- Oricorio styles
- Basculin stripes
- Toxtricity forms
- Meowstic genders
- Squawkabilly plumages
- Tatsugiri forms
- Gastrodon forms
- Wormadam cloaks
- Lycanroc forms
- Indeedee genders
- Oinkologne genders
- Basculegion genders
- Paldean Tauros breeds

Kantonian Tauros remains a separate full-weight identity from the combined Paldean Tauros family.

Use equal encounter-family weights initially rather than power-based rarity tiers. Balance-specific rarity may be added later from play data.

### Battle-only forms

Store the ordinary owned identity and let the battle engine manage temporary battle states. Do not place these temporary states independently in the encounter pool:

- Aegislash Shield/Blade
- Wishiwashi Solo/School
- Palafin Zero/Hero
- Eiscue Ice/Noice
- Minior Meteor/Core
- Cherrim weather form
- Castform weather forms
- Morpeko Full Belly/Hangry
- Cramorant states
- Mimikyu Disguised/Busted

Darmanitan Zen Mode is excluded. Neither Darmanitan may generate or gain Zen Mode through an ability-changing item.

### Cosmetic forms

Cosmetic variants do not receive independent encounter weight or bypass duplicate prevention. Use a default appearance or random cosmetic variant for forms such as Vivillon patterns, Florges colors, Furfrou trims, Alcremie decorations, Sawsbuck seasons, Unown letters, Dudunsparce segments, and Maushold family size.

## 7. Generated Pokémon attributes

These rules apply to player encounters, including guaranteed starters:

- Level: `100`.
- IVs: each of the six stats is independently and uniformly randomized from `0` through `31`.
- EVs: `0` in every stat.
- Nature: uniformly random among all 25 natures.
- Ability: uniformly random among the species/form's distinct ordinary, non-hidden abilities.
- Hidden abilities are never assigned at generation.
- Gender follows the species/form's normal gender rules.
- Shiny probability is the modern unmodified base-game rate: `1 / 4096`.
- There is no Sunday shiny bonus and no Shiny Charm modifier in the current scope.

Trainer Pokémon use stats configured by their trainer/daily-challenge templates, not encounter-generation rules. The initial development Brock team may retain its fixed 15-IV/85-EV test spread until trainer content is replaced.

## 8. Training items

Training items are used outside battle. They are consumed only after a valid change succeeds. Canceling, errors, selecting the current value, or targeting an ineligible Pokémon consumes nothing.

### EV items

- HP Up adds one HP EV.
- Protein adds one Attack EV.
- Iron adds one Defense EV.
- Calcium adds one Special Attack EV.
- Zinc adds one Special Defense EV.
- Carbos adds one Speed EV.
- Pomeg, Kelpsy, Qualot, Hondew, Grepa, and Tamato Berries remove one EV from their corresponding stats.
- Players may configure a stack quantity.
- Enforce `0–252` EVs per stat and `510` total EVs.
- Before confirmation, cap the applied quantity to what is legal and show the actual cost/effect.
- Charge and consume only the quantity successfully applied.

### Bottle Cap

- A Bottle Cap edits one selected IV.
- The player may choose any integer from `0` through `31`.
- The UI defaults to `31`.
- It is consumed only if the confirmed IV differs from the current IV.

### Nature Mint

- A Nature Mint lets the player choose any nature.
- It is consumed only after the effective nature changes.

### Ability Capsule

An Ability Capsule never grants a hidden ability.

- If the current ability is ordinary and exactly one other ordinary ability is eligible, switch automatically to the other ability.
- If the Pokémon has only one ordinary ability and currently has it, the Capsule is unusable.
- If the current ability is hidden and the Pokémon has one ordinary ability, switch automatically to that ordinary ability.
- If the current ability is hidden and the Pokémon has two ordinary abilities, let the player choose between them.
- Consume the Capsule only after the ability changes.

### Ability Patch

- An Ability Patch changes an ordinary ability to the eligible hidden ability.
- It does not change a hidden ability back to an ordinary ability.
- It is unusable if the Pokémon already has its hidden ability or has no allowed hidden ability.
- Consume it only after the ability changes.
- Zen Mode is not an allowed hidden ability for either Darmanitan.

### Persistent form-changing items

Form changes persist outside battle, but do not change duplicate-family identity.

#### Rotom Catalog

- Only base Rotom is encounterable.
- The Catalog may change an owned Rotom among Base, Heat, Wash, Frost, Fan, and Mow forms.
- It is a one-use training item and may be repurchased after use.
- It is consumed only after confirming a different form.
- Returning to base form also requires and consumes another Catalog.
- It costs `1,200` coins in the initial economy.

#### Oricorio Nectars

- Oricorio styles are separate grouped encounter outcomes.
- Red, Yellow, Pink, and Purple Nectar change an owned Oricorio to the corresponding style.
- A Nectar is consumed only after confirming a different style.

#### Paldean Tauros Cud items

- Combat, Blaze, and Aqua Breed are grouped encounter outcomes with `1/3` weight each.
- Owning any breed blocks encounters with all three breeds.
- Each form-specific Cud changes an owned Paldean Tauros to its target breed.
- A Cud is consumed only after confirming a different breed.

Move changes associated with form changes are **Deferred** until the move system is finalized.

## 9. Held items, inventory, and the shop

- Pokémon may hold at most one held item.
- Players may move owned held items between Pokémon outside battle.
- Non-consumable held items may be purchased from the shop only once per run.
- Held items that activate once or are consumed within a battle may be purchased in any quantity.
- Each owned copy may be equipped to only one Pokémon at a time.
- Battle-consumable held items are restored for later battles; consumption is temporary battle state, not permanent inventory deletion.
- Multiple copies therefore allow multiple party members to equip the same consumable simultaneously.
- An individual holder's death after a win does not delete the owned held item.
- A full wipe deletes the run's inventory and resets purchase restrictions.
- Items may be sold. Sale values and exact sale behavior are deferred with economy pricing.

### Snorlax and Leftovers

- Every encountered Snorlax arrives holding Leftovers.
- Shop-purchased Leftovers remains subject to the one-purchase-per-run restriction.
- A Snorlax-provided copy bypasses that restriction, making repeated Snorlax encounters the only approved path to multiple Leftovers in one run.
- No special anti-farming limit is required; the strategy is sufficiently rare and inefficient.

### Initial economy and prices

- A fresh run starts with `2,500` coins.
- Vitamins cost `10` coins per one-EV item.
- EV-reduction berries cost `8` coins per one-EV item.
- Bottle Cap costs `750`; Nature Mint `400`; Ability Capsule `600`; Ability Patch `1,400`; Rotom Catalog `1,200`.
- Each Nectar costs `300`; each Paldean Tauros Cud costs `500`.
- Premium held items cost `1,200`: Assault Vest, Booster Energy, Choice Band, Choice Scarf, Choice Specs, Covert Cloak, Focus Sash, Heavy-Duty Boots, Leftovers, Life Orb, Loaded Dice, and Rocky Helmet.
- Strong held items cost `800`: Eject Button, Eject Pack, Expert Belt, Flame Orb, Light Clay, Mental Herb, Mirror Herb, Power Herb, Protective Pads, Safety Goggles, Scope Lens, Shed Shell, Throat Spray, Toxic Orb, Weakness Policy, Wide Lens, and Wise Glasses.
- Most Berries cost `180`; Sitrus, Lum, and Custap Berries cost `350`.
- Type Memories cost `250`; ordinary single-type power boosters cost `300`.
- Other one-use held items cost `450`; other reusable held items cost `550`.

These are first-pass balance values and live in the content layer so playtesting can tune them without changing inventory rules. Battle payouts, sale values, and special rewards remain **Deferred**.

## 10. Moves and TMs

Initial move-generation policy, cross-generation learnset policy, TMs, move tutoring, and later player editing restrictions are **Deferred** for a dedicated owner discussion. Until that discussion, generated Pokémon receive a deterministic temporary battle-ready moveset from their Showdown learnset. No TMs are present in the Mart or Bag.

Do not treat the older move-generation proposal as final approval. Generated moves must eventually be persisted so refreshes cannot reroll them.

## 11. Battles

- Use Pokémon Showdown as the authoritative simulation engine.
- Current battles use Generation 9 Custom Game mechanics.
- Battles are level-100 singles in set mode.
- Ordinary switching is allowed unless prevented by battle mechanics.
- There is no free switch prompt after an opposing Pokémon faints.
- Mega Evolution, Z-Moves, Dynamax, Terastallization, and similar gimmicks are disabled in the current scope.
- Bag items cannot be used in battle.
- Critical hits, accuracy, status, and secondary effects follow the simulator.
- Preparation changes cannot mutate an already-committed battle team.
- Active battles must resume after refresh or reconnect.
- Battle actions, outcomes, and ownership are server-authoritative.

Before battle, expose the opponent's Pokémon, moves, and held items. Do not expose exact opponent stats or natures. Opponent ability visibility remains open.

### Current trainer AI

- Never switches voluntarily.
- Uniformly chooses a random currently legal move.
- Cannot use bag items.
- After a faint, sends the next living Pokémon in fixed team order.
- Commits its choice before receiving the player's action.

### Initial Brock slice

- Fixed order: Steelix, Golem, Rhyperior, Aerodactyl, Sudowoodo, Magcargo.
- Steelix leads.
- Brock currently has no held items.
- The existing fixed development stats remain a temporary trainer configuration, not the player-encounter generation rule.

## 12. Trainers and daily rotation

Trainer content should support:

- Fully fixed teams where desired.
- A fixed ace plus curated teammate pools.
- Type-themed pools derived from approved Pokémon.
- Explicit team sizes, sets, abilities, items, stat configurations, and AI policy.
- Content/rules versioning so an already-generated daily challenge never mutates after content updates.

All Pokémon in the approvals CSV are eligible for both player and trainer use. Player ownership and duplicate rules do not restrict trainer generation. Player-only starter encounter restrictions do not restrict trainer teams.

Exact trainer rosters, pools, schedule selection, difficulty curve, and future AI improvements remain **Deferred**.

## 13. Persistence and backend authority

The server must own and validate:

- Game date and daily-attempt eligibility.
- The shared daily opponent.
- Accounts, runs, roster ownership, party assignments, items, and money.
- Encounter generation, reservations, claims, and duplicate prevention.
- Pokémon attributes and applied training.
- Battle team snapshots, actions, outcomes, casualties, rewards, and wipes.
- Win streaks and lifetime records.
- Monthly resets.

Operations that spend items/money or finalize battles must be transactional and idempotent. Concurrent tabs must not double-spend, duplicate claims, or finalize one battle twice.

The current local JSON stores are development infrastructure. Production requires a durable database, migrations, backups, operational logging, and a recovery path for failed transactions.

## 14. Content import rules

The approvals CSV contains independent side-by-side lists; a row does not associate the Pokémon in the first column with the held or training items on that row.

At import time:

- Normalize display names to canonical Showdown IDs.
- Reject unknown or ambiguous identifiers.
- Attach explicit encounter-family IDs and form policy metadata.
- Keep approval data versioned with generated challenges and owned Pokémon.
- Do not connect production gameplay directly to a mutable Google Sheet.
- Import a reviewed snapshot into application data or database migrations.
- Map sprites through canonical IDs rather than display names.

Recommended Pokémon content fields include:

```text
showdown_id
display_name
encounter_family_id
form_kind
encounter_weight
starter_eligible
player_eligible
trainer_eligible
```

## 15. Explicitly deferred or open work

- Initial moves, legal learnset policy, TMs, tutors, and moveset editing.
- Battle payouts, sale values, and special economy rewards.
- Trainer templates beyond the existing Brock slice.
- Exact daily trainer generation and difficulty progression.
- Post-battle encounter access and partial claims.
- Global game timezone and cross-rollover battle behavior.
- Box capacity, releasing, and full-box behavior.
- Detailed held-item interactions involving theft, recycling, swapping, or suppression.
- Draws, timeouts, abandoned battles, and exceptional loss handling.
- Production database, hosting, backups, recovery, and migrations.
- Real leaderboard calculations and presentation.
- Asset/license review and public-launch fan-project wording.
