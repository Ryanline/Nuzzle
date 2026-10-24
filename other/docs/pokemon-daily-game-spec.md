# Pokémon Daily Battle Game — Living Project Specification

> **Supporting design history:** The current owner-approved rules are consolidated in [`INFO.md`](INFO.md). When this document conflicts with `INFO.md`, use `INFO.md`.

Version: 0.1  
Last updated: October 15, 2026  
Project name / domain: TBD  
Status: Pre-implementation specification for a first playable version (FPV)

## 1. Purpose and instructions for Codex

Build a clean, fast, web-based daily Pokémon battle game with persistent team building, permanent Pokémon deaths, individualized encounters, a shared daily opponent, and a monthly campaign reset.

This document is the source of truth for product behavior. It consolidates the project owner's decisions; it does not represent an existing implementation.

### Requirement status

- **Confirmed:** Owner-approved behavior. Implement as written unless the owner changes it.
- **Open:** Not decided. Do not silently invent a permanent rule.
- **Proposed:** A suggested implementation approach or temporary prototype default, not an owner-approved product decision.
- **Later:** An idea outside the initial playable scope unless explicitly brought forward.

Unless otherwise labeled, gameplay requirements in sections 2–11 are confirmed. Sections 12–16 contain proposed implementation guidance, scope, and validation. Section 17 collects open decisions.

Before implementing a subsystem, resolve only the open decisions that block it. Continue independent work where possible. Keep tunable values in configuration, record temporary assumptions, and update this document when the owner approves a change. Do not substitute earlier suggestions for the latest rules here.

## 2. Product concept and design priorities

### Core concept

Players maintain a roster of Pokémon and attempt one official battle each day. Everyone faces the same opponent on a given date, but players have different encounters, investments, teams, and casualties. Winning builds a daily win streak. Losing a battle destroys the run; missing a day breaks the streak. Monthly resets refresh teams and the combat economy without automatically ending an otherwise continuous win streak.

The campaign builds toward four Elite Four battles and a Champion battle on the final five days of each month.

### Design priorities

1. A short daily battle with meaningful preparation.
2. Attachment to Pokémon and meaningful consequences for losing them.
3. Enough replacement encounters that normal attrition does not routinely leave players unable to field a team.
4. Choices between investing deeply in a few strong Pokémon and maintaining a versatile roster.
5. A shared daily challenge that players can discuss, approached with individualized resources.
6. A clear, restrained interface with minimal friction.

This is intentionally Nuzlocke-like and can be brutal. It need not guarantee victory or make every late-month start equally favorable.

### Time expectations

- Battle: approximately five minutes.
- Encounter reveal / guaranteed catching: approximately one minute, with optional additional inspection time.
- Pokémon inspection: roughly another minute if the player wants it.
- Shopping and PC management: as much or as little time as the player chooses.

These are experience targets, not mandatory timers. Do not artificially delay encounter reveals.

## 3. Daily player experience

### Landing page: today's trainer

The main page shows today's trainer and their Pokémon. **Battle** is the most prominent action. Secondary actions provide access to **Tall Grass / Encounters**, **PC**, and **Shop**.

Opponent moves and held items must be available to inspect before battle. They need not all appear expanded on the landing page. Exact opponent stats and natures are not publicly shown.

The player may prepare in any order before committing to battle. The experience must not force a daily encounter or shopping trip before every battle, provided the player has an eligible party.

### Typical flow

1. Open today's trainer page.
2. Optionally inspect the opponent's Pokémon, moves, and items.
3. Optionally claim encounters, manage the PC, or shop.
4. Select Battle, choose a lead from the party, and begin.
5. Play one official singles battle.
6. Receive the result, casualty summary, and any earned rewards.
7. Return tomorrow for the next shared opponent.

There is no in-app practice mode before the official attempt and no same-day retry after a loss.

**Open:** Whether encounters can be claimed after a completed battle, and whether their individual reveals can be split across the day. The backend must preserve whatever encounters have already been generated rather than rerolling them on refresh.

## 4. Campaign calendar and shared opponents

### Daily schedule

| Calendar condition | Battle | Encounter behavior |
| --- | --- | --- |
| Ordinary day | Regular trainer | 3 regular encounters |
| Friday outside the finale | Gym battle | 3 regular encounters |
| Sunday | Battle determined by the calendar | 4 regular encounters; ordinary eligibility and shiny odds still apply |
| Final five days of the month | Elite Four 1, Elite Four 2, Elite Four 3, Elite Four 4, Champion | Normal weekday/Sunday encounter rules still apply |
| First day of the month / fresh run | Battle determined by the calendar | Fresh-run encounter rules apply; overlap with regular encounters is open |

The finale overrides a Friday gym battle. Sunday bonuses remain encounter rules and do not replace the scheduled battle.

For a month of length `N`, schedule Elite Four 1 on `N - 4`, Elite Four 2 on `N - 3`, Elite Four 3 on `N - 2`, Elite Four 4 on `N - 1`, and Champion on `N`. Handle 28-, 29-, 30-, and 31-day months.

### Shared challenge

- All players face the exact same trainer lineup, moves, abilities, held items, and opponent stat configuration for a given game date.
- Encounters are individualized entirely.
- Trainer progression is calendar-based, not based on a player's streak.
- Losing to Elite Four 1 does not block Elite Four 2 the next day. The next battle remains the calendar's next battle, with a fresh player run after the loss.
- Earlier badges or Elite Four wins are not entry requirements for the next day's battle.

### Trainer generation

Trainer templates should support a fixed ace and a curated pool for other party slots. Some trainers may use fully fixed teams. The trainer pool, exact schedule selection, sets, and difficulty curve remain open.

Generate and persist one shared opponent per date. Do not generate a different opponent per user. Do not change an active daily opponent casually after players have already attempted it.

### Late joining

Players may join at any point in the month and face that day's opponent. Starting early naturally provides more opportunities to accumulate resources. There is no confirmed catch-up grant beyond the normal fresh-run package. Do not add a large late-entry subsidy or scale the opponent down for new users without approval.

## 5. Runs, streaks, losses, and resets

### Definitions

- **Party:** Up to six living Pokémon selected for battle.
- **Box:** Owned living Pokémon outside the party.
- **Roster:** Party plus box.
- **Run:** The Pokémon, money, and combat inventory accumulated since the latest new-run reset.
- **Win streak:** Consecutive game dates on which the player wins the official battle.
- **Wipe:** A battle loss that ends the run, even if other living Pokémon remain in the box.

### Individual deaths

- Any Pokémon that faints during an official battle dies permanently.
- Winning the battle does not restore dead Pokémon.
- Dead Pokémon cannot be selected for future battles.
- Their held items survive and return to usable ownership.
- Historical casualty records may retain their information, but they no longer count as currently owned for duplicate prevention.
- All surviving Pokémon receive free full healing between battles.

### Battle loss / full wipe

On a loss:

1. The win streak ends.
2. The entire run roster is lost, including boxed Pokémon.
3. All run money and items are lost.
4. The cumulative wipe counter increases.
5. A fresh roster is rerolled for the new run.
6. The player cannot attempt another official battle until the next game date.

Losses grant no money. Keeping a boxed team does not protect the run from a battle loss.

**Open:** Whether the new roster is revealed immediately after the loss or on the following date. In either case, no same-day second battle is allowed.

### Intentional rerolling

Intentionally losing to obtain a new team has the same consequences as any other wipe. Do not add a free unlimited reroll action. A cumulative wipe counter records failures, including intentional ones. A separate voluntary reset/forfeit control is not yet specified.

### Missing a day

Missing a game date breaks the win streak. There is no participation streak and no participation-streak reward.

**Open:** Whether missing a day has any consequence for the roster or economy beyond ending the streak. Do not assume absence causes a wipe or increments the wipe counter.

### Monthly reset

- Teams reset on the first of every month.
- Money resets monthly.
- A continuous win streak can survive the monthly reset; it is not reset merely because the month changed.
- A new monthly run begins with the fresh-run encounter package.
- Lifetime records, including wipe counts and earned battle records, should persist.

**Open:** Whether all combat items reset monthly, and whether any special Champion reward can carry over. Do not treat proposed carryover rewards as implemented exceptions.

### Records

Track the current win streak, individual gym badges, Elite Four wins, and cumulative wipes. Champion victory records are relevant to the campaign. Best streak and detailed history are proposed additions. Cosmetic currency is later scope.

## 6. Encounters, eligible Pokémon, and the PC

### Fresh-run encounters

- A fresh run receives **10 Pokémon**.
- The first Pokémon is guaranteed to be a randomly selected fully evolved starter.
- There is no starter choice screen.
- The remaining Pokémon are random eligible encounters, subject to duplicate and starter restrictions.
- The same first-encounter starter guarantee applies after a wipe and at a new month.

**Open:** Whether the 10-Pokémon package replaces or supplements that date's 3/4 ordinary encounters. Proposed prototype default: replace them, avoiding an additional fresh-run encounter advantage. This default requires approval.

### Ordinary encounters

- **3 encounters per day.**
- **4 encounters on Sundays.**
- Capturing is guaranteed. There is no wild battle or catch-success roll.
- Starters cannot appear in ordinary encounters, including Sundays.
- All encountered Pokémon are fully evolved and level 100.
- No leveling or evolution gameplay is included.

### Duplicate prevention

- Exclude only Pokémon currently owned in the party or box.
- Dead Pokémon can be encountered again.
- Eggs must also respect current-ownership duplicate prevention when implemented.
- No historical duplicate ban persists across wipes or months.
- Separate final evolutions such as Poliwrath and Politoed are distinct and can both be owned.
- During a multi-Pokémon encounter batch, reserve each generated result before drawing the next so the batch cannot produce duplicates.

**Open:** Form-level identity, eligibility of single-stage species, legendary/mythical/Paradox/Ultra Beast availability, battle-only forms, and the exact starter roster. Maintain explicit eligible species and starter lists rather than inferring the owner's intended pool from every simulator entry.

### Encounter-type guarantees

Items may guarantee an encounter of a specified type. They must not override the starter-only restriction for a guaranteed starter slot.

For that slot, valid outcomes must belong to both the starter pool and the requested type pool. The owner's intended examples are that a Fire guarantee restricts the starter result to Fire starters, while a Steel guarantee can produce Empoleon where the configured starter pool makes it the eligible result. A guarantee with no eligible starter match, such as Bug under the intended pool, cannot apply.

**Open:** Item name, acquisition, whether it affects one encounter or a batch, item consumption, and empty-pool UI behavior. Proposed behavior: reject an inapplicable item before consuming it. Apply current-ownership exclusions before confirming a nonempty candidate pool.

### PC and roster management

- Party maximum: 6.
- Players can choose a lineup from their living roster and manage held items and moves outside battle.
- A box capacity limit is under consideration; the size and overflow behavior are not decided.
- The game should favor interesting lineup selection over routinely forcing players to fight with too few Pokémon.

Do not silently discard a guaranteed catch when the box is full. Resolve capacity/overflow behavior before enforcing a cap.

### Balance intent

Three daily encounters are intended to offset ordinary casualties while leaving the loss of a strong, invested Pokémon painful. Consistently losing four or five Pokémon should deplete the roster. A broad box provides versatility but spreads investment; a narrow, highly trained team is efficient but risks losing concentrated investment.

The expectation of roughly three casualties per battle is a design hypothesis, not measured data or a target that every battle must enforce. Encounter count, opponent strength, and potential box capacity should be evaluated together.

## 7. Initial move-generation specification

This section applies to automatically generated starting moves. Later moveset changes through TMs/tutors are a separate system.

### 7.1 Learnset source

Use the Pokémon's eligible learnable moves from the chosen ruleset/data policy. The ruleset and cross-generation learnset policy are open. Do not combine incompatible learnset sources accidentally.

Movesets contain up to four distinct move IDs. Do not select the same move twice. If the eligible learnset contains fewer than four moves, do not invent moves to fill the slots.

### 7.2 Three move classes

| Class | Meaning | Selection role |
| --- | --- | --- |
| Ordinary damaging | Damaging move with a fixed nominal base power | Preferred for STAB selection and the three-damaging-move minimum |
| Backup damaging | Fixed-damage or variable-power damaging move | Used as fallback for guarantees/minimums; freely eligible in unrestricted slots |
| Status | Non-damaging move | Eligible in unrestricted slots and when damaging options are exhausted |

Use move mechanics, not names or a simple `basePower > 0` check alone, to classify moves. Fixed-damage and variable-power moves may require explicit metadata or an audited classification layer.

**Open edge classification:** Multi-hit moves, conditional power multipliers, OHKO moves, retaliation moves, and other special cases need a consistent policy against the selected simulator data. Do not quietly classify all unusual attacks as ordinary. Keep these cases explicit and testable.

### 7.3 Step A — one STAB guarantee per type

For each of the Pokémon's types:

1. Find unused ordinary damaging moves of that type in its eligible learnset.
2. If any exist, rank them by nominal base power, descending.
3. Form a candidate pool from the top three moves **including all ties at the third-move cutoff**.
4. If fewer than three exist, use all of them.
5. Select one from that pool and add it to the moveset.
6. If there are no ordinary damaging moves of that type, select from eligible unused backup damaging moves of that type if any exist.
7. If neither kind exists, skip the guarantee for that type.

For ties, use the BP of the third move in the sorted list, not the third distinct BP value. Example: powers `[110, 90, 90, 90, 80]` produce a four-move candidate pool: the 110 move and all three 90 moves. Powers `[100, 100, 100, 90]` produce only the three 100 moves.

A monotype Pokémon normally gets one guaranteed STAB move; a dual-type Pokémon normally gets two. Availability can reduce those counts.

### 7.4 Step B — reach three damaging moves if possible

Count the damaging moves already selected, including any backup damaging STAB selected in Step A.

Until the moveset contains at least three damaging moves:

1. If any unused ordinary damaging moves remain, select one randomly from all of them, regardless of type or BP.
2. Otherwise, if unused backup damaging moves remain, select one randomly from that pool.
3. Otherwise stop; the learnset cannot provide the minimum.

Unselected moves from the earlier STAB candidate pools remain eligible. Selecting a Flying STAB move does not exclude the other Flying attacks from subsequent slots.

### 7.5 Step C — fill remaining slots without category restrictions

Fill each remaining slot, up to four, by selecting randomly from all unused eligible moves: ordinary damaging, backup damaging, and status.

Usually this means the fourth move can be anything. If the Pokémon cannot learn three distinct damaging moves, earlier remaining slots can also receive status moves once all damaging options have been used.

### 7.6 Required fallback example

If a Dragon-type's only eligible damaging Dragon moves are Dragon Claw and Dragon Rage:

- Dragon Claw is the guaranteed Dragon STAB selection because an ordinary damaging option exists.
- Dragon Rage does not compete with it for that guaranteed selection.
- When filling the three-damaging-move minimum, other unused ordinary damaging moves take priority over Dragon Rage.
- If ordinary damaging options are exhausted and more damaging moves are needed, Dragon Rage qualifies as a backup.
- Dragon Rage can always be selected in an unrestricted slot if it remains unused.

If Dragon Rage were the only eligible damaging Dragon move, it could satisfy the STAB fallback in Step A.

### 7.7 Selection weights and subsequent editing

**Proposed default:** Uniform random selection among distinct moves in each candidate pool. Do not add power/accuracy/physical-special weighting without approval.

**Open:** Whether STAB and three-damage constraints apply only at generation or also restrict later player editing. The owner has specified them for initial moves; do not impose a permanent editing restriction without approval.

Persist the generated moveset. Reloading, reopening an encounter, or reconnecting must not generate new moves.

## 8. Battle rules and opponent information

### Confirmed mechanics

- Singles battles.
- All Pokémon are level 100.
- Set mode: no free switch prompt after an opposing Pokémon faints.
- Ordinary switching is allowed unless prevented by battle mechanics.
- Critical hits, accuracy checks, and secondary effects follow normal mechanics in the chosen ruleset.
- No bag-item use during battle: no Potions, X items, or similar actions.
- Held items are supported.
- Free full healing between battles.
- One official attempt per game date; no retry after losing.

### Rules engine and sprites

The project intends to rely heavily on the Pokémon Showdown repository for battle simulation/data and use the sprite resources/style used by Showdown for consistency.

Any generation's Pokémon may be considered. Battles currently use Pokémon Showdown's Generation 9 Custom Game mechanics. Mega Evolution, Z-Moves, Dynamax, Terastallization, and similar battle gimmicks are disabled for the current playable scope.

### Public opponent information

Before battle, expose the opponent's Pokémon, moves, and held items. Do not expose exact stats or natures. Opponent abilities are part of the shared team configuration; their pre-battle visibility is open.

Information should be accessible without overcrowding the home screen. Because opponents are shared, public moves/items avoid rewarding players solely for obtaining externally shared scouting information.

### AI

The trainer AI never switches voluntarily. It prioritizes defensive priority against a faster KO threat, guaranteed KOs, situational utility, one elevated status use per active Pokémon, possible KOs, and then the strongest ordinary damage. Damaging moves within 10% of the best estimate are selected randomly. Later useful status moves rank below damage, while ineffective choices rank last. Critical hits are excluded from AI damage forecasts. Pivot and forced replacements are random. The AI selects and commits its action before the player submits an action, so it cannot react to hidden player intent.

Trainers cannot use bag items in battle. The initial Brock team also has no held items.

### Initial Brock configuration

Brock's fixed team order is Steelix, Golem, Rhyperior, Aerodactyl, Sudowoodo, and Magcargo. Steelix is the lead. Each Pokémon has four configured moves, no held item, and uses the common development stat spread described below.

## 9. Items, rewards, and economy

### Currency and rewards

- Regular trainer wins grant money.
- Gym wins grant more than regular trainer wins.
- Elite Four wins grant more than gym wins.
- Wins may grant special rewards.
- Losses grant no money.
- Purchases have no quantity limits beyond affordability and applicable inventory rules.
- Items can be sold.
- Money resets on a wipe and monthly.

Prices, payouts, sale values, starting money, and exact special rewards are open. Champion cosmetic-currency rewards are a later feature. A Champion reward allowing a chosen encounter-type guarantee is tentative; its carryover behavior needs a decision.

### Shop scope

Planned shop categories include:

- Bottle caps / IV manipulation.
- Vitamins / EV manipulation.
- TMs.
- Move tutoring.
- Held items.
- Encounter-type guarantee items.
- Possibly eggs.

The minimum initial inventory and detailed mechanics for each category are open. No in-battle usable bag items are needed.

Purchases are allowed before inspecting/revealing the opponent. Since the home page exposes the trainer and inspection is available, this does not establish a reveal-based purchase lock. The UI is intended to allow pre-battle preparation; do not add a lockout after inspection without approval.

### Held-item lifecycle

- A held item remains owned after its holder dies in a battle the player wins.
- Battle-consumable held items are expended for that battle but restored for later battles, rather than permanently deleted from inventory.
- Examples include Focus Sash and Sitrus Berry.
- Restoration between battles must not cause an automatic second use within the same battle.
- A full wipe removes all run items, including those recovered from dead holders.

**Open:** Interaction with within-battle recycling, theft, swapping, removal, and other item effects. Use separate persistent ownership and battle-state representations so ordinary battle effects do not accidentally duplicate or permanently delete owned items.

### Pokémon attributes

Players should be able to inspect their own Pokémon's nature, stats, moves, and relevant details. New player encounters receive independently random `0–31` IVs, zero EVs, a random nature, and a random ordinary non-hidden ability. Training items must follow the chosen stat rules and limits.

The existing development roster and Brock slice may retain their temporary 15-IV/85-EV configuration until they are replaced by generated player records and trainer templates.

## 10. Visual direction and UX

### Desired feel

A simple fanmade daily puzzle game: clean, fast, understated, and easy to understand. The owner finds even Daily Red somewhat busy and wants a calmer interface.

Use original site branding and layout. Avoid presenting the project as an official Pokémon product or imitating an official commercial game's entire interface. Asset/licensing and monetization review remain a separate launch work item; visual restraint is a design requirement, not a substitute for that review.

### Proposed UI guidelines

- Clear typography, generous spacing, a restrained palette, and one obvious primary action per view.
- Consistent Pokémon sprites with accessible text labels.
- Minimal animation; quick optional encounter reveals rather than long sequences.
- No dashboard full of competing cards, currencies, banners, and counters.
- Show detailed information on demand through a detail panel or expanded row.
- Responsive layouts for phones and desktop browsers.
- Keyboard-accessible controls, readable contrast, and useful loading/error states.
- On mobile battle screens, present public simulator events in a fixed-height inline log with contained vertical scrolling and a brief staggered reveal for genuinely new entries. Follow new entries only while the reader remains near the bottom. Expanded mode becomes an opaque card over the command controls below the battle visual while leaving Give Up visible; use an explicit expand/collapse control rather than a gesture-driven sliding drawer.
- Use an original CSS-rendered rocky battlefield rather than the preparation-screen arena image. Keep combatants in stable, platform-aligned stage slots with the opponent in the upper-right and the player in the lower-left. Put compact opaque HP/status cards in the opposite corners so labels never float over sprites; show exact HP only for the player and a percentage for the opponent.

### Screen outline

| View | Essential content |
| --- | --- |
| Today | Trainer, team preview, inspectable moves/items, prominent Battle button, encounters/PC/shop access, win streak |
| Lead selection | Current party and clear lead choice before commitment |
| Battle | Active Pokémon, HP/status, legal moves, switching, concise readable battle events |
| Encounters | Remaining claims, optional applicable encounter item, reveal and Pokémon detail |
| PC | Party and box, filtering/sorting as needed, Pokémon details, team/item/move management |
| Shop | Balance, understandable prices/effects, buying and selling |
| Results | Win/loss, casualties, rewards, streak change, and next available battle |
| Records | Wipe count, badges, Elite Four/Champion history; keep secondary to daily play |

During battle, preparation actions must not mutate the already-committed team. On refresh or reconnect, return the player to the existing battle rather than starting another.

## 11. Future features and explicit exclusions

### Later / tentative

- Persistent cosmetic currency, possibly called gems.
- Making Pokémon shiny or other cosmetic purchases.
- Champion cosmetic rewards.
- Eggs.
- More trainers, rival battles, and themed events.
- Shareable result cards and leaderboards, if desired.
- Advertising.

Encounter shininess uses the unmodified modern base-game rate of `1/4096`; Sunday does not increase it. Paid cosmetics are not specified.

### Not part of the current design

- Starter selection by the player.
- Leveling or evolution progression.
- Streak-based opponent scheduling.
- Participation streaks or participation rewards.
- Manual wild capture battles.
- Same-day official retries.
- Pre-attempt in-app practice.
- In-battle bag items.
- Historical species bans that prevent encountering dead Pokémon again.

Do not reintroduce these from earlier brainstorming without a new owner decision.

## 12. Proposed backend architecture

This section is implementation guidance, not a selected technology stack. Choose a stack after checking compatibility with the chosen battle simulator version and deployment target.

### Initial shape

A responsive web client, one application backend, a persistent database, and a server-controlled battle simulation layer are sufficient as an initial structure. Avoid unnecessary microservices. The architecture should permit expanding battle execution capacity later.

### Server authority

The server should own and validate:

- Game date and attempt eligibility.
- Daily shared opponent configurations.
- Encounter generation, duplicate filtering, and initial moves.
- Run state, living roster, party selection, and held-item ownership.
- Purchases, sales, training, and currency changes.
- Battle actions, random outcomes, and battle results.
- Casualties, rewards, wipes, streaks, and monthly resets.

The client must not be trusted to declare a win, choose its encounter, adjust currency, or reset an attempt. Return only intended public opponent fields to the client; do not send hidden stats in a payload and merely hide them visually.

### Persistence and reliability

- Give each official attempt a unique user/date identity.
- Freeze the player's battle-ready team and opponent configuration at battle start.
- Persist enough battle state, seed/version information, and accepted actions to resume reliably.
- Make encounter claims, purchases, finalization, and resets transactional and idempotent.
- Serialize or version concurrent actions so two browser tabs cannot spend the same money or overwrite a battle turn.
- Persist generated encounters before presenting them.
- Finalize death, reward, streak, and wipe changes once, even after network retries.
- Apply monthly resets once and in a defined order relative to old battles.
- Distinguish network/server failure from an intentional forfeit. A transient disconnect alone should not silently kill a run.

### Accounts and hosting

Playing and tracked sections require a Nuzzle account. The landing page remains visible while logged out; selecting a game section opens the login card and continues to the requested section after authentication. The header provides a persistent account control and a per-device light/dark theme switch. Successful login persists on the device through a secure server session rather than storing credentials or authentication tokens in browser storage. There is no guest mode in the current direction.

The local-development implementation uses username/password accounts, scrypt password hashes, 30-day HttpOnly same-site cookies, and a replaceable JSON store under `backend/data/`. Usernames are case-insensitively unique and passwords require at least 15 characters. Email, password recovery, verification, and social login are intentionally deferred. Before public deployment, migrate account/progress data to a durable database and add recovery, operational logging, backups, migrations, and production abuse controls.

Before public launch, include operational logging, backups, basic abuse controls, database migrations, and a way to inspect/recover failed game transactions. Avoid choosing infrastructure solely around hypothetical large scale; measure actual usage.

## 13. Proposed data model

These are conceptual entities, not a mandated schema.

| Entity | Main responsibility |
| --- | --- |
| User/profile | Identity, settings, long-term records |
| Season | Month boundaries, schedule, content/rules version |
| Run | Roster/economy lifecycle; start/end reason |
| Owned Pokémon | Species/form, moves, nature, ability, IVs/EVs, item, living/dead state |
| Party assignment | Ordered selection of up to six owned living Pokémon |
| Inventory / ledger | Item ownership and auditable money/item changes |
| Encounter claim | Date, slot, generated result, item modifier, claimed state |
| Trainer template | Fixed ace, teammate pool, sets, difficulty/AI configuration |
| Daily challenge | One persisted opponent snapshot for a game date |
| Battle attempt | User/date identity, team snapshots, state, actions, final result |
| Lifetime record | Streaks, wipes, badges, Elite Four and Champion wins |

Keep account history separate from resettable run resources. Keep owned items separate from their temporary battle state. Keep rules/content versions attached to generated challenges and attempts.

## 14. Proposed first playable scope and implementation order

### First playable scope

Build one complete vertical slice with persistence:

1. Today page and inspectable daily opponent.
2. Fresh-run 10-Pokémon encounter package and guaranteed random starter.
3. Daily 3/4 encounters, starter restrictions, duplicate protection, and specified move generation.
4. PC party selection and lead selection.
5. One official level-100 singles battle per date using the chosen engine/ruleset.
6. Permanent deaths, survivor healing, battle-item restoration, rewards, wipes, and streaks.
7. A small approved shop inventory with buying/selling and real effects.
8. Calendar handling for Fridays, Sundays, month-end finale, and monthly resets.
9. Saved/resumable state and basic records.

The owner must approve any temporary exclusions from the confirmed rules. Ads, cosmetic currency, expansive content, and elaborate animation are unnecessary for the first playable.

### Build order

1. Resolve mechanics/learnset format, date policy, initial stats, and blocking fresh-run rules.
2. Implement and validate encounter and move generation as independent domain logic.
3. Integrate one battle with a small trainer dataset and simple documented AI.
4. Add run transitions, casualties, inventory, streaks, and resumability.
5. Build the restrained UI around that working loop.
6. Add the configurable calendar and minimal economy/content.
7. Playtest multiple simulated dates and tune encounter/economy/opponent balance.

Use development-only date controls and fixture encounters to test calendar boundaries and losses without waiting weeks. These must not grant ordinary users date manipulation or rerolls.

## 15. Acceptance criteria

### Encounters and moves

- A fresh run grants 10 unique currently unowned eligible Pokémon; the first is a random fully evolved starter.
- Ordinary claims grant 3 Pokémon, or 4 on Sunday, subject to the agreed fresh-run overlap rule.
- All ordinary encounters exclude starters, including Sundays.
- Living party/box duplicates are excluded; dead species may return.
- Sequential results within one batch cannot duplicate one another.
- A monotype receives its available STAB guarantee; a dual-type receives one per type where possible.
- BP ties at the third-move cutoff expand the candidate pool correctly.
- Ordinary damage is preferred over backup damage for guaranteed selections/minimums.
- Backup damage can fill missing damaging slots and can appear freely in unrestricted slots.
- Status moves do not satisfy the damaging-move minimum.
- No moveset repeats a move ID or invents an unavailable move.
- Reloading a claim cannot change its Pokémon, attributes, or moves.

### Battles and lifecycle

- Two users on the same game date see the same opponent configuration, while encounters can differ.
- Party size never exceeds six; fainted Pokémon cannot re-enter future battles.
- A win removes casualties, heals survivors, grants the configured rewards, and updates the streak once.
- A held consumable used in battle is available in a later battle without automatic reuse during the first battle.
- A loss clears the entire run roster, money, and items, breaks the streak, increments wipes once, and prevents another attempt that date.
- Losing Elite Four 1 does not block the next day's Elite Four 2.
- Missing a date breaks the streak without awarding participation rewards.
- Monthly reset replaces the team and resets money without automatically breaking an otherwise continuous streak.
- Finale scheduling works for every month length and overrides Friday gyms.
- Sunday encounter behavior still applies when Sunday falls during the finale.
- Refreshes, duplicate requests, and concurrent tabs cannot grant extra attempts, encounters, or rewards.
- Hidden opponent stats/natures are not exposed through ordinary client responses.

### UX

- The first screen makes today's trainer and the Battle action immediately clear.
- Encounters, PC, and Shop are easy to find without competing equally with Battle.
- Opponent moves/items and owned Pokémon details are inspectable without displaying everything at once.
- Mobile and desktop layouts remain readable and usable.
- Battle completion clearly communicates casualties, rewards, and next availability.

## 16. Balance questions to measure

During playtesting, record:

- Casualties per win, segmented by trainer tier and roster strength.
- Run wipe frequency and streak lengths.
- Roster size over multiple days.
- Whether strong teams become effectively unchallenged before month-end.
- Whether weak starts can make interesting choices rather than only suffer predictable losses.
- Frequency of redundant or low-value encounters.
- Currency accumulation and the relative value of training versus new coverage.
- Average daily time spent battling and preparing.

Use these observations to tune opponent sets, encounter eligibility, prices, rewards, and a possible box cap. Do not automatically increase encounter counts further or weaken every opponent to make all runs survive.

## 17. Open decision register

| ID | Decision | Needed before |
| --- | --- | --- |
| D01 | Legal learnset policy beyond the current Generation 9 Custom Game battle slice | Encounter and moveset generation |
| D02 | Eligible species/forms, starter list, single-stage and legendary eligibility, random weights | Encounter generation |
| D03 | Trainer-template natures, abilities, and stat configurations beyond the current Brock slice | Trainer generation |
| D04 | Confirm uniform move rolls; classify unusual damage mechanics | Finalizing move generator |
| D05 | Whether fresh-run 10 replaces daily encounters; post-wipe reveal timing | Encounter/run lifecycle |
| D06 | Global game timezone, rollover, cross-midnight battle completion, expiry, and month-boundary ordering | Daily gating and resets |
| D07 | What a missed day does beyond ending the streak | Run lifecycle |
| D08 | Box cap and full-box handling; release functionality | Enforcing capacity |
| D09 | Monthly item reset and any Champion carryover exception | Monthly inventory reset |
| D10 | Shop inventory, prices, payouts, sale values, starting money, training/TM/tutor behavior | Economy |
| D11 | Encounter-item scope/consumption and empty-pool behavior; eggs if included | Encounter modifiers |
| D12 | Future AI difficulty, broader trainer datasets/sets, and opponent ability visibility | Expanded trainer battle integration |
| D13 | Forfeit, draw, timeout, abandoned battle, and exceptional non-faint loss behavior | Reliable battle finalization |
| D14 | Held-item recycling/theft/swap behavior and persistent ownership rules | Complete item lifecycle |
| D15 | Post-battle encounter access and partial daily claims | Encounter UI and eligibility |
| D16 | Restrictions, if any, on player-edited movesets | TM/tutor management |
| D17 | Production account database/provider, recovery, deployment, and backups | Persistent end-to-end release |
| D18 | Title/domain, asset/license review, fan-project wording, future ad placement | Public launch / monetization |

Resolve these incrementally. Do not interpret open questions as permission to expand scope.

## 18. Decision log

### October 20, 2026 — Encounter, form, and training rules

- The canonical consolidated rules now live in `INFO.md`, with content approvals in `other/data/nuzzle-approvals.csv`.
- Player encounters use random `0–31` IVs, zero EVs, random natures, random ordinary abilities, and a `1/4096` shiny rate.
- Each eligible fully evolved starter form has equal guarantee weight; starters never enter ordinary encounters, including Sundays.
- Regional forms are distinct, specified multi-form families share one total encounter weight and duplicate identity, and temporary battle forms are not separate encounters.
- Ability Capsules switch only among/to ordinary abilities as specified in `INFO.md`; Ability Patches change ordinary abilities to hidden abilities only.
- Bottle Caps edit a chosen IV, while vitamins and reduction berries adjust their corresponding EV by one point per item.

### October 19, 2026 — First working battle slice

- Battles use Pokémon Showdown Generation 9 Custom Game mechanics at level 100.
- Mega Evolution, Z-Moves, Dynamax, and Terastallization are disabled.
- All current Pokémon use 15 IVs and 85 EVs in every stat.
- Brock uses Steelix, Golem, Rhyperior, Aerodactyl, Sudowoodo, and Magcargo in that order, with no held items.
- Trainer AI never switches voluntarily, chooses a random currently legal move, and commits before the player's choice is received.
- Battle events use an ordered, scrollable mobile log that includes both sides' moves and important public Showdown effects without relying on battle animations.
- Encounter integration, smarter AI, and post-battle roster consequences remain outside the first battle-engine implementation.

### October 19, 2026 — Initial account slice

- Gameplay sections require an account; the public landing screen acts as the login boundary.
- The header hamburger is replaced by a per-device light/dark control and an account control whose signed-in state is visible at a glance.
- Local development uses username/password registration with persistent server sessions. Authentication cookies are HttpOnly and battle records are owned by their creating user.
- Profiles currently use a circular first-letter avatar. Custom profile-picture uploads are excluded from the beta.
- Email, account recovery, and third-party login are deferred until production infrastructure is selected.

### October 15, 2026 — Initial consolidated specification

- Daily encounter count is **3**, or **4 on Sundays**, superseding earlier counts.
- Fresh-run roster is **10**, beginning with a random fully evolved starter.
- No starter choice; starters otherwise appear only in Sunday's ordinary pool.
- All Pokémon are fully evolved and level 100; no level progression.
- Individual fainting causes permanent death; a battle loss wipes the entire run.
- Current ownership alone determines duplicate exclusion.
- There is only a win streak; it breaks on losses and missed days.
- Daily opponents are shared; calendar progression takes precedence over streak progression.
- Opponent moves/items are visible; exact stats and natures are hidden.
- Fixed-damage and variable-power moves are fallback damaging options, not primary BP-ranked selections when ordinary damaging moves exist.
- The UI should be clean, restrained, and clearly fanmade.

For future changes, append the date, changed rule, reason, and any migration implications. Update the normative sections as well so implementers do not have to reconstruct current behavior from the log.
