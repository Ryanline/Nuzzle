# Nuzzle — Living Project Context

Last updated: October 25, 2026

This is Nuzzle's living source of truth. It consolidates the former canonical rules document and original project specification into one reference for humans and coding agents.

The reviewed content allowlist remains separate in [`data/nuzzle-approvals.csv`](data/nuzzle-approvals.csv). Its side-by-side columns are independent lists; Pokémon and items on the same CSV row are not associated.

## Vision

Nuzzle is a mobile-first daily Pokémon challenge about preparation, attachment, and consequence. Everyone faces the same trainer on a given day, but each player develops a different run through random encounters, team construction, training, TMs, held items, and permanent casualties.

The experience should feel closer to Pokémon Showdown than a conventional Pokémon RPG: mechanically legible, quick to enter, and focused on team decisions rather than travel, capture odds, leveling, or evolution. One official battle should take roughly five minutes, while preparation can be as brief or involved as the player wants.

The interface is deliberately restrained: plain typography, familiar sprites, compact panels, and secondary details shown on demand. Primary screens should fit naturally on phones without routine page scrolling. Long collections such as encounters, the Mart, Bag, and battle log may scroll inside contained regions.

The central loop is:

1. Inspect today's shared trainer and team.
2. Claim encounters and prepare up to six living Pokémon.
3. Spend limited money on moves, training, and held items.
4. Commit to the day's single official battle.
5. Keep survivors, permanently lose casualties, and extend the run—or wipe and rebuild.

The game is intentionally Nuzlocke-like and can be harsh. It should create interesting preparation choices, not guarantee that every roster wins.

## Product Principles

- One consequential official singles battle per account per game date.
- The opponent is shared; player encounters, investments, teams, and losses are individual.
- Persistent attachment matters: fainting in an official battle means permanent death.
- Losing or forfeiting destroys the whole run, including boxed Pokémon.
- Preparation is optional once the player owns a battle-eligible team; encounters and shopping are not forced daily chores.
- There is no practice battle or same-day retry.
- Server state is authoritative for anything that affects fairness or persistence.
- Content and balance should remain configurable and be tuned from real play data.

## Current Player Experience

### Landing page

- Shows the Nuzzle number, trainer name, game date, rollover countdown, and the day's full trainer team.
- Battle is the primary action, with PC, Bag, Encounters, Mart, Leaderboard, and Settings available underneath.
- Logged-out visitors can see the landing page. Selecting a tracked section opens authentication and continues to the requested section after login.
- The header contains a remembered light/dark switch and account/avatar control.
- The layout accounts for compact iPhone and Android viewports and mobile browser chrome.

### Accounts and profiles

- Username/password registration and login are implemented.
- Usernames are case-insensitively unique. Passwords must contain 15–128 characters.
- Passwords use scrypt hashes; sessions use 30-day HttpOnly, SameSite cookies.
- Each account sees a one-time welcome dialog after its first authentication; acknowledgement persists across devices and sessions.
- Accounts default to a Pokémon Showdown trainer avatar, which can be changed from the account view.
- Theme is remembered per device independently of login and defaults to light. Dark mode uses `#121212`.
- The configured administrator account has trainer scheduling and daily-attempt reset controls.
- There is no guest mode, email, password recovery, social login, or custom image upload in the beta.

### Encounters

- Catching is guaranteed; there is no wild battle or capture roll.
- A fresh run starts with zero Pokémon and twelve separate opening encounter cards.
- The first opening result is a random fully evolved starter. There is no starter choice.
- Every eligible final starter evolution has equal guarantee weight; standard and regional evolutions are separate equal-probability results.
- Each opening encounter is claimed individually. Unclaimed opening encounters survive date rollover.
- Claiming the first Pokémon unlocks Battle. The first six claimed Pokémon fill Team; later claims enter the Box.
- After the opening set, ordinary dates provide three encounters and Sundays provide four.
- Starters do not appear in ordinary encounters, including Sundays.
- Results are generated and persisted server-side before reveal, so refreshes cannot reroll them.
- A claimed result stays visible for the current visit, then disappears from the encounter screen after leaving.
- Duplicate protection covers the entire living roster and results reserved in the same batch. A dead Pokémon may be encountered again.
- Encounter eligibility comes only from the approvals CSV; never infer it from every Showdown species.

### PC

- Shows today's trainer team first as a preparation reference, then the player's Team, then boxed Pokémon.
- A Pokémon appears in Team or Box, never both. Team size is at most six.
- Supports adding/removing team members and drag reordering.
- The detail drawer has Summary and Training sections. Summary shows identity, types, ability, nature, held item, calculated battle stats, and moves.
- Training provides a compact, non-scrolling, Showdown-inspired mobile editor in a drawer that shares its height, Pokémon header sizing, and normalized bottom actions with Summary. Each horizontal stat row shows the stat name, base value, synchronized numeric EV and slider controls, numeric IV with a compact Max IV shortcut, and final calculated value. Nature choices are grouped by the stat they raise, followed by neutral natures; ability, eligible forms, and a searchable legal-move catalog follow below. Changes and resulting stats are previewed before purchase, then applied together in one server-authoritative transaction.
- Held items can be given or taken without closing the item view; the holder and Bag update immediately.
- Training shows the pending-change count, total cost, and resulting balance. Lowering EVs or IVs is free; only values raised above their persisted baseline are charged. Resetting or restoring a value before applying costs nothing.
- There is currently no box capacity, release action, filtering, or selling.

### Bag and Mart

- The Mart and Bag contain held items. Training and moves are purchased directly through a Pokémon's Training editor in the PC.
- The Bag shows owned inventory and contextual use/equip actions.
- The Mart uses compact rows, optional item information, and a purchase drawer.
- Stackable items use a mobile quantity selector showing current money, owned quantity, selected quantity, and total price.
- Held items are normally limited to one shop purchase per run.
- Selling is not implemented.

### Battle preview and battle

- The player sees the trainer team and selects a lead from a compact six-sprite row.
- Selecting a lead shows a Showdown-style summary with ability, held item, all six stats, and four moves.
- Battles are level-100 Generation 9 Custom Game singles powered by Pokémon Showdown.
- Set mode is used: there is no free switch prompt after an opposing Pokémon faints.
- Ordinary switching is allowed unless battle mechanics prevent it.
- The battle view has an arena, compact HP/status panels, move buttons, six switch buttons, contained event log, information tooltips/long press, and Give Up.
- The player's exact HP is visible; the opponent is represented by public HP information. The trainer's Pokémon, moves, and held items are inspectable before battle, but exact trainer stats and natures are not exposed.
- Critical hits, accuracy, status, secondary effects, and held-item behavior come from Showdown.
- Bag items cannot be used in battle.
- Mega Evolution, Z-Moves, Dynamax, Terastallization, and comparable gimmicks are disabled.
- Preparation changes made after battle creation cannot alter the snapshotted teams.
- Active battles are server-owned and resume after refresh or reconnect.

### Results, death, and wipes

- Each account gets one official attempt per game date.
- On a win, every participating Pokémon that fainted dies permanently. Boxed Pokémon are safe from an individual winning battle.
- Casualties are matched to roster Pokémon by original identity, not mutable Showdown team position.
- Surviving Pokémon receive free healing between daily battles.
- A dead holder's owned held item remains available in the Bag.
- A win awards ₽15,000 and contributes to the win streak.
- A loss or Give Up ends the streak and immediately wipes the entire roster, money, inventory, and per-run purchase history.
- A wipe creates a fresh run with ₽50,000 and twelve opening encounters immediately, while leaving that day's attempt spent.
- Losses grant no money and boxed Pokémon do not protect a run from defeat.

### Leaderboards

- **Streak** ranks accounts by consecutive daily wins ending on the current date and includes zero-day streaks.
- **Daily** places wins ahead of losses, then ranks each result group by fewest casualties and earliest completion.
- Daily rows show rank, account/avatar, battle team, green survivors, red casualties, and losses.
- Streaks are currently derived from saved battle history rather than stored as a separate lifetime-record model.

### Trainer administration

- Admin tooling supports trainer drafts, a queued daily schedule, reordering, and immutable published daily snapshots.
- Trainer sets are imported in Showdown format with species, ability, nature, IVs, EVs, moves, held item, gender, and shiny state.
- Each date has one persisted shared opponent for all players. Encounters remain individualized.
- The active implementation uses the configured queue; automatic Friday Gym and month-end Elite Four/Champion selection is still future campaign logic.

## Runs, Calendar, and Campaign Direction

A **party** is the ordered selection of up to six living Pokémon. The **box** contains other owned living Pokémon. The **roster** is party plus box. A **run** contains the living roster, money, inventory, and purchase restrictions since the most recent wipe or monthly reset.

- The game date rolls over at midnight in `America/New_York`.
- Joining late gives the ordinary fresh-run package and the current trainer; there is no opponent scaling or catch-up subsidy.
- Missing a day breaks a computed win streak but does not wipe the run.
- The first request in a new calendar month resets the run and presents twelve opening encounters. A streak can conceptually cross the boundary because a monthly reset alone is not a loss.
- Battles that cross midnight and other exceptional rollover races need further hardening before a larger launch.

Approved campaign direction, not yet automatically implemented:

- Ordinary dates use regular trainers.
- Fridays outside the finale use Gym Leaders.
- The final five dates of each month are Elite Four 1–4 and Champion, regardless of month length.
- The finale overrides Friday Gym scheduling; Sunday encounter counts still apply.
- Calendar progression is global, not gated by a player's badges, prior wins, or streak.
- Losing an Elite Four battle does not block the next calendar opponent.
- Lifetime wipe, badge, Elite Four, Champion, and best-streak records need a durable record model; the current beta primarily derives daily/streak standings from battle files.

## Pokémon Generation and Identity

Every player encounter, including the guaranteed starter, uses:

- Level `100`.
- Six independent uniformly random IVs from `0–31`.
- `0` EVs in all six stats.
- A uniformly random nature.
- A uniformly random distinct ordinary, non-hidden ability.
- Normal species/form gender rules.
- Base shiny odds of `1/4096`, without a Sunday bonus or Shiny Charm.

Trainer Pokémon instead use the explicit values in their trainer sets.

### Duplicate and form identity

- Stable canonical Showdown IDs are persistence, API, and sprite keys; CSV display names are not identifiers.
- Branch evolutions such as Poliwrath and Politoed are separate identities.
- Regional forms are separate encounters unless explicitly grouped. Owning Raichu does not block Alolan Raichu.
- Form-changing items do not change the Pokémon's duplicate-family identity.
- Grouped families share one total encounter weight and one duplicate identity. With `n` forms, each normally receives weight `1/n`.
- Current grouped families include Gourgeist sizes, Oricorio styles, Basculin stripes, Toxtricity forms, Meowstic genders, Squawkabilly plumages, Tatsugiri forms, Gastrodon forms, Wormadam cloaks, Lycanroc forms, Indeedee genders, Oinkologne genders, Basculegion genders, and Paldean Tauros breeds.
- Kantonian Tauros remains separate from the combined Paldean Tauros family.
- Battle-only states are not encounter entries: Aegislash Blade, Wishiwashi School, Palafin Hero, Eiscue Noice, Minior Core, weather Cherrim/Castform, Morpeko Hangry, Cramorant states, and Mimikyu Busted are managed by Showdown.
- Darmanitan Zen Mode is excluded from generation and ability-changing items.
- Cosmetic forms do not receive independent weight or bypass duplicate prevention. Default or selected representations cover patterns, colors, trims, decorations, seasons, letters, segments, and family size.
- Only base Rotom is encounterable; appliance forms come from the Rotom Catalog.
- Smeargle is excluded from player, trainer, and encounter content.

## Generated Movesets

- Starting moves come from the Pokémon's legal direct Showdown learnset and are persisted once generated.
- Movesets contain four moves except Ditto and Unown's intentional repeated special cases.
- Every ordinary type receives a damaging STAB slot when a legal candidate exists.
- Normal qualifying STAB has at least 60 effective base power and 70% accuracy. If none exists, use a weaker legal damaging STAB with at least 70% accuracy.
- Bullet Punch for Scizor and Accelerock for Midday/Dusk Lycanroc are explicit sub-60-power priority exceptions.
- STAB selection favors 75–100 effective power. Moves from 60–74 remain viable at moderately lower weight.
- Accuracy directly scales weight: a 70%-accurate move has 70% of an otherwise equivalent perfectly accurate move's weight.
- Physical/special choices favor the species's stronger attacking stat without making alternatives impossible.
- Dual types normally receive one damaging STAB per type. Pyukumuku, Wobbuffet, Ditto, and Unown are mechanical exceptions; Revelation Dance supplies Oricorio's style-dependent STAB.
- After STAB and guaranteed signatures, unrestricted slots can contain damaging, utility, status, or setup moves. Setup moves may generate naturally even though setup TMs are excluded.

Guaranteed signature moves are:

`Hyper Fang` (Raticate), `Shell Side Arm` (Galarian Slowbro), `Raging Bull` (all Tauros), `Leaf Blade` (Sceptile), `Needle Arm` (Cacturne), `Weather Ball` (Castform), `Horn Leech` (Sawsbuck), `Gear Grind` (Klinklang), `Esper Wing` (Hisuian Braviary), `King's Shield` (Aegislash), `Topsy-Turvy` (Malamar), `Flying Press` (Hawlucha), `Forest's Curse` (Trevenant), `Trick-or-Treat` (Gourgeist), `Spirit Shackle` (Decidueye), `Triple Arrows` (Hisuian Decidueye), `Darkest Lariat` (Incineroar), `Beak Blast` (Toucannon), `Ice Hammer` (Crabominable), `Revelation Dance` (Oricorio), `Pollen Puff` (Ribombee), `Accelerock` (Midday/Dusk Lycanroc), `Baneful Bunker` (Toxapex), `Trop Kick` (Tsareena), `Shore Up` (Palossand), `Multi-Attack` (Silvally), `Zing Zap` (Togedemaru), `Anchor Shot` (Dhelmise), `Aura Wheel` (Morpeko), `Stone Axe` (Kleavor), `Bullet Punch` (Scizor), `Torch Song` (Skeledirge), `Aqua Step` (Quaquaval), `Flower Trick` (Meowscarada), `Double Shock` (Pawmot), `Population Bomb` (Maushold), `Salt Cure` (Garganacl), `Gigaton Hammer` (Tinkaton), `Matcha Gotcha` (Sinistcha), `Electro Shot` (Archaludon), `Jet Punch` (Palafin), `Triple Dive` (Wugtrio), `Spin Out` (Revavroom), and `Fillet Away` (Veluza).

Optional signature-pool moves, favored but not forced, are:

`Volt Tackle` (Raichu), `Crabhammer` (Kingler), `Bonemerang`/`Bone Club` (Marowak), `Shadow Bone` (Alolan Marowak), `Blaze Kick` (Blaziken), `Muddy Water` (Swampert), `Heat Crash` (Emboar), `Ceaseless Edge` (Hisuian Samurott), `Night Daze` (Zoroark), `Fire Lash` (Salazzle), `Clanging Scales` (Kommo-o), `Dire Claw` (Sneasler), and `Kowtow Cleave` (Kingambit).

## Training Items and Form Changes

Training-item names and prices define the cost of direct PC training; they are no longer purchased or stored in the Bag. A staged build is charged only after the complete final build validates and succeeds. Canceling, resetting, errors, or restoring the current value costs nothing.

Legacy runs are migrated once: owned Training Items and TMs are removed and fully refunded at their current catalog prices.

- HP Up, Protein, Iron, Calcium, Zinc, and Carbos price EV increases at ₽10 per point in their respective stat.
- EVs may be lowered directly for free. A staged value is charged only for the amount above that Pokémon's persisted EV value.
- Enforce `0–252` per stat and `510` total EVs.
- Raising one IV above its persisted value costs one Bottle Cap. Lowering an IV is free; the UI defaults its quick-set action to `31`.
- A Nature Mint lets the player choose any nature.
- An Ability Capsule never grants a hidden ability. It switches automatically between eligible ordinary abilities, is unusable when no alternative ordinary ability exists, and lets a hidden-ability holder return to an eligible ordinary ability.
- An Ability Patch only changes an ordinary ability to an eligible hidden ability. It never reverses a hidden ability and cannot grant Zen Mode.

Form-change prices remain based on the corresponding Training Items, but the change is purchased directly in the PC editor. Form changes persist and preserve duplicate-family identity:

- **Rotom Catalog:** Change owned Rotom among Base, Heat, Wash, Frost, Fan, and Mow. Returning to Base also consumes a Catalog.
- **Nectars:** Change owned Oricorio among Baile, Pom-Pom, Pa'u, and Sensu.
- **Cud items:** Change owned Paldean Tauros among Combat, Blaze, and Aqua Breed.

A form change is charged only when it produces a different valid form. Existing moves are retained when legal for the destination form; any incompatible move must be replaced as part of the same staged build before it can be applied.

## Held Items and Persistent Ownership

- A Pokémon holds at most one item; each owned copy can be equipped to only one Pokémon.
- Every shop-held item can normally be purchased once per run, even if Showdown consumes it during battle.
- Battle consumption is temporary. Focus Sash, Berries, and similar owned items return for later battles.
- An individual holder's death returns the owned item to availability. A full wipe deletes run inventory.
- Encounter rewards may create extra copies. Snorlax always arrives with Leftovers and is the approved way to exceed the shop's single Leftovers copy.
- Thief and Covet permanently take the opponent's item when the player's Pokémon entered battle empty-handed.
- Trick and Switcheroo are temporary when the player entered holding an owned item; that original item is restored afterward. If the player entered empty-handed and received an item, the received item persists.
- Magician and Pickpocket follow the same empty-handed persistence rule.
- Persisted stolen items enter inventory and are equipped to the acquiring survivor. Settlement is idempotent and cannot award the item twice.
- Recycle only restores a consumed item inside the current battle. Knock Off affects the current trainer battle only.

## Economy and TMs

### Economy

- Fresh run money: ₽50,000.
- Daily victory reward: ₽15,000.
- EV increases: ₽10 per point. Legacy EV-reduction Berries retain an ₽8 refund value but reductions are free in Training.
- Bottle Cap: ₽900; Nature Mint: ₽1,500; Ability Capsule: ₽2,000; Ability Patch: ₽3,000.
- Rotom Catalog: ₽2,000; Nectar: ₽750; Paldean Tauros Cud: ₽1,000.
- Premium held items cost ₽2,500: Assault Vest, Booster Energy, Choice Band, Choice Scarf, Choice Specs, Covert Cloak, Focus Sash, Heavy-Duty Boots, Leftovers, Life Orb, Loaded Dice, and Rocky Helmet.
- Strong held items cost ₽1,800. Most reusable held items cost ₽1,400; most battle-consumable held items cost ₽1,200.
- Most Berries cost ₽600; Sitrus, Lum, and Custap cost ₽1,000.
- Type Memories and ordinary single-type power boosters cost ₽750.

These are first-pass balance values. Tune them in content data rather than changing ownership rules.

### TM scope

- TMs replace level-up, egg, tutor, HM, and conventional limited-TM move-learning paths.
- A Pokémon can use only a move in its own direct/inherited Showdown learnset.
- A successful move change replaces one current move, charges that move's TM price, and persists. Illegal, identical, reordered, or canceled changes cost nothing.
- Moves can be purchased repeatedly through Training without carrying TMs in the Bag.
- Sketch does not make every move available through Smeargle, and moves no approved Pokémon can directly learn are omitted.
- Pure setup TMs are excluded, including common boosting moves such as Swords Dance, Dragon Dance, Nasty Plot, Calm Mind, Bulk Up, Quiver Dance, Shell Smash, Belly Drum, Shift Gear, Coil, defensive boosts, and speed boosts.
- Spore, Revival Blessing, Shed Tail, Baton Pass, Minimize, and Double Team are also excluded.

### TM pricing

- Damaging moves begin at ₽16 per effective base-power point.
- Major-status secondary effects add ₽5 per percentage point, capped at ₽900.
- One-stage stat drops add ₽1 per percentage point; drops of two or more stages add ₽2 per point.
- Accuracy below 100 subtracts ₽10 per missing percentage point.
- Moves represented by Showdown as always hitting receive a ₽100 adjustment.
- Damaging priority adds ₽500. A chance to raise the user's stats adds ₽10 per percentage point. Draining adds ₽10 per percentage point recovered.
- Recoil, recharge, two-turn attacks, self-drops, and exceptional utility receive smaller adjustments.
- Fixed multihit moves use total power; variable 2–5-hit moves use 3.5 hits.
- Formula results have a ₽500 floor and round upward to the nearest ₽50.
- Electro Ball and Gyro Ball cost ₽1,000.
- Population Bomb costs ₽2,400; Aura Wheel, Focus Punch, and Last Resort ₽1,800; Rapid Spin ₽1,300; Dream Eater ₽1,100.
- Protect-family moves cost ₽2,000. Recover equivalents cost ₽2,000; Synthesis/Morning Sun/Moonlight cost ₽1,750. Reflect/Light Screen cost ₽1,350. Weather/terrain setters cost ₽1,200. Perish Song costs ₽2,000.
- Strong accurate status moves such as Thunder Wave cost around ₽1,000; useful unreliable moves such as Sleep Powder ₽750; niche status ₽500; low-value moves such as Growl ₽250; Splash ₽100.

Manual content prices override the algorithm whenever mechanics make the estimate misleading.

## Trainer Battle AI

The current opponent is deterministic rule-based selection, not machine learning:

1. If the faster player can possibly KO, use damaging priority when available and effective. A failed Sucker Punch is not retried for the rest of that battle.
2. Prefer a guaranteed KO.
3. Prefer contextually useful moves, such as screen removal into screens or Haze into boosts.
4. Prefer the active trainer Pokémon's first useful status/utility use.
5. Prefer a move whose ordinary damage roll could KO; critical hits are ignored in this estimate.
6. Prefer highest estimated ordinary damage. Randomly choose among moves within 10% of the best move's damage.
7. Rank later useful status moves below ordinary damage.
8. Put immune, redundant, or failing choices last.

The trainer commits before seeing the player's current action, begins each new battle with a randomly selected team member, never voluntarily switches, chooses another random living team member when forced to replace a fainted Pokémon or after a pivot move, and cannot use Bag items. These selections are saved in the battle record so replaying a persisted battle cannot reroll them.

## Interface and Accessibility Direction

- Maintain original site branding and a clearly fanmade presentation; do not recreate an official game's entire commercial shell.
- Favor one obvious primary action, readable contrast, generous spacing, minimal animation, and useful loading/error states.
- Expose detail through drawers, tabs, expanded rows, hover, and long press rather than crowding primary screens.
- Keep controls keyboard accessible and touch targets practical.
- Battle events remain in a fixed-height scrollable log. Expanded mode may cover command controls but must leave Give Up reachable.
- Use general responsive and sprite-anchoring rules. Avoid species-specific layout fixes.
- Do not add long artificial encounter animations, competing dashboard cards, extra currencies, or decorative clutter without a clear gameplay need.

## Technical Architecture and Authority

- `frontend/` is a framework-free HTML/CSS/JavaScript single-page mobile UI.
- `backend/server.js` serves the frontend and JSON API.
- `backend/game-store.js` owns runs, encounters, rosters, teams, money, inventory, purchases, training, monthly resets, and wipe resets.
- `backend/battle-service.js` owns Showdown sessions, commands, trainer AI, battle records, leaderboards, results, casualties, and persistent item acquisition.
- `backend/trainer-store.js` owns trainer drafts, scheduling, and published daily opponents.
- `backend/auth-store.js` owns accounts, avatars, and sessions.
- `backend/content.js` validates and builds approved content from the CSV and Showdown data.

The server must remain authoritative for dates, attempt eligibility, shared trainers, encounter generation, claims, duplicate filtering, owned Pokémon, team order, items, money, training, battle snapshots, actions, randomness, outcomes, rewards, deaths, and wipes. The client must never declare a win, choose its encounter result, or directly mutate resources.

Operations that spend or finalize state must be idempotent and safe against retries. Battle settlement, encounter claims, purchases, training, rewards, theft, deaths, and wipes must not apply twice. Preserve enough snapshots/actions to resume a battle and audit a disputed result.

Backend tests cover authentication, content validation, encounters, economy, persistence, trainer scheduling, AI, battles, permadeath, wipes, item persistence, and leaderboards. Browser checks cover the major mobile flows.

## Production and Deployment

Production runs from private GitHub `main` on a small DigitalOcean Ubuntu Droplet at <https://nuzzle-game.duckdns.org>. GitHub Actions deploys pushes to `main`, keeps only the active release on the VM, and restarts the Node service. Nginx and HTTPS front a service bound to localhost.

Persistent production state currently uses private JSON files beneath `/var/lib/nuzzle`; local state defaults beneath `backend/data/`. Deployments must preserve this directory. The VM has swap for its constrained memory footprint.

This persistence model is appropriate only for the small beta. Before meaningful growth, migrate to a durable transactional database with migrations, automated backups, tested restoration, operational logging, recovery tooling, and stronger abuse controls. A transient network failure must never count as an intentional forfeit or silently corrupt a run.

## High-Level Evolution

1. **Initial specification and prototype** — Defined the shared daily challenge, monthly campaign ambition, Nuzlocke consequences, restrained mobile UX, PC, encounters, economy, and first static screens.
2. **Real battle slice** — Added Pokémon Showdown, playable singles, battle logs, move/switch controls, information cards, sprites, and responsive arena positioning.
3. **Accounts and persistent runs** — Added registration, sessions, themes, account-scoped encounters, rosters, teams, money, inventory, and battle ownership.
4. **Approved content and economy** — Imported the curated allowlist, implemented forms and duplicate families, generated movesets, eligible TMs, training actions, held-item rules, quantity purchasing, and initial prices.
5. **Mobile refinement** — Reworked drawers, IV/EV views, lead selection, battle HUD sizing, sprite anchoring, contained scrolling, dark mode, browser-height handling, and compact landing headers.
6. **Production deployment** — Moved the private full stack to DigitalOcean with HTTPS, DuckDNS, SSH administration, automated `main` deployment, swap, monitoring, and release cleanup.
7. **Daily operations** — Added trainer import/scheduling, immutable daily snapshots, one-attempt enforcement, result sharing, midnight Eastern rollover, shiny trainer Pokémon, and admin attempt resets.
8. **Consequences and rewards** — Added ₽15,000 wins, individual permadeath, loss/forfeit wipes, immediate fresh runs, retained held-item ownership, and identity-safe casualty settlement.
9. **Competitive context** — Added daily and streak leaderboards, losses and zero-day streaks, trainer-sprite avatars, and survivor/casualty displays.

## Explicit Exclusions and Future Work

Do not reintroduce these without a new owner decision:

- Player-selected starters.
- Leveling or evolution progression.
- Manual wild battles or capture odds.
- Streak-scaled opponents.
- Same-day official retries or pre-attempt practice battles.
- In-battle Bag items.
- Historical bans preventing dead Pokémon from being encountered again.
- Smeargle.

Open or deferred work:

- Automatic Gym/Elite Four/Champion calendar generation and a larger balanced trainer library.
- Durable lifetime records for wipes, badges, Elite Four/Champion wins, and best streak.
- Cross-midnight battle expiry/finalization policy and stronger concurrent-tab protection.
- Database migration, backups, restoration, logging, account recovery, and production abuse controls.
- Box capacity, release behavior, sorting, and filtering, if they become necessary.
- Sale values and whether selling should ever be added.
- Draws, timeouts, abandoned battles, and exceptional simulator failures.
- Opponent ability visibility before battle.
- Form-change move replacement behavior.
- Encounter-guarantee items beyond explicitly configured specialty rewards.
- Asset/license review and public-launch fan-project wording.
- Optional later ideas such as eggs, rivals, themed events, cosmetic currency, cosmetic shininess, and Champion cosmetics.

## Balance Questions to Measure

- Casualties and wipes by trainer tier and roster strength.
- Streak distribution and roster size over time.
- Whether strong teams become effectively unchallenged before month-end.
- Whether weak starts still create decisions instead of predictable failure.
- Frequency of redundant or low-value encounters and generated movesets.
- Currency accumulation and the tradeoff between coverage, stats, abilities, and held items.
- Daily battle/preparation time and mobile usability across devices.

Tune encounter weights, prices, rewards, AI, and trainer sets from these observations. Do not automatically solve difficulty by increasing encounter counts or weakening every trainer.

## Repository Layout

- `frontend/` — framework-free application UI, styling, image assets, and static/browser QA helpers.
- `backend/` — HTTP API, authentication, game state, trainer scheduling, content validation, Pokémon Showdown battles, and automated tests.
- `other/README.md` — this living product, rules, implementation, and operational reference.
- `other/data/nuzzle-approvals.csv` — reviewed Pokémon and item allowlists used to construct application content.
- `other/ops/` — production service and reverse-proxy configuration references.
- `ops/known_hosts` — pinned production SSH host key kept at the workflow-compatible root path.
- `.github/workflows/` — CI and production deployment automation.
- `package.json` and `package-lock.json` — repository-level Node runtime, dependencies, and commands.

Runtime-generated account and game data beneath `backend/data/` is ignored locally. Production state lives outside deployed releases under `/var/lib/nuzzle`.

## Run Locally

The project requires the Node version declared in `.nvmrc`/`package.json`. From the repository root:

```bash
nvm use
npm install
npm run dev
```

Open <http://127.0.0.1:3000>. The Node server serves both the frontend and API; a separate frontend development server is unnecessary.

## Tests and Maintenance Workflow

Run the backend suite and optional browser checks from the repository root:

```bash
npm test
npm run test:browser
```

Work from `main` during the current beta unless the owner explicitly introduces another branch. Preserve unrelated local files and production state. Normal completed changes are tested, committed, and pushed for live phone testing—except when the owner explicitly asks to leave work uncommitted.

When changing a settled rule, update the relevant normative section here in the same change. Add historical explanation only when it helps future maintainers understand a migration or non-obvious constraint; this file should describe the current truth, not accumulate a commit-by-commit diary.
