# Nuzzle — Canonical Game and Implementation Information

Last updated: October 24, 2026

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
- Profiles use a circular first-letter avatar. Custom profile-picture uploads are outside the current beta.
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
- A newly claimed encounter remains visible for the current visit so the result can be inspected. After leaving and returning, claimed cards are hidden; the server still retains their results and claim state.
- The encounter count and Back button remain fixed while the encounter-card list scrolls independently on small screens.

### Fresh runs and starter guarantees

- A fresh run begins with zero Pokémon, so its trainer battle is locked at first.
- A fresh run presents twelve separate opening encounters instead of that date's ordinary three/four encounters. Each card is revealed and claimed individually, and unclaimed opening encounters remain available across date rollover.
- The first claimed opening Pokémon unlocks battling. The first six claimed Pokémon automatically fill the team; the remaining six go to the PC.
- The first of the twelve opening encounters is the guaranteed starter for the first-ever encounter, the first encounter of a new month, or the first encounter after a wipe.
- Overlapping conditions create one guarantee, not multiple guarantees.
- The guarantee is consumed only after the encounter is successfully generated and persisted.
- The guaranteed result is a fully evolved starter; there is no starter choice screen.
- Every eligible starter evolution has equal weight. Standard and regional evolutions are separate equal-probability results—for example, Typhlosion and Hisuian Typhlosion each receive the same chance as every other eligible starter evolution.
- Starters never appear in ordinary encounters, including Sundays.
- Guaranteed starters use the same stat, nature, ability, gender, and shiny generation rules as other encounters.

After all twelve opening encounters are claimed, later dates use the ordinary three-encounter schedule, or four encounters on Sunday.

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

### Consumable form-changing items

Form changes persist outside battle, but do not change duplicate-family identity. Every form-changing item is consumed after a successful change and can be purchased again. An item is not consumed when the selected Pokémon or target form is ineligible.

#### Rotom Catalog

- Only base Rotom is encounterable.
- The Catalog may change an owned Rotom among Base, Heat, Wash, Frost, Fan, and Mow forms.
- It is a one-use training item and may be repurchased after use.
- It is consumed only after confirming a different form.
- Returning to base form also requires and consumes another Catalog.
- It costs ₽2,000 in the initial economy.

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
- The PC item view uses **give** for available held items and **take** for the Pokémon's current item.
- Every held item may be purchased from the shop only once per run, including items that activate once or are consumed within a battle.
- Each owned copy may be equipped to only one Pokémon at a time.
- Battle-consumable held items are restored for later battles; consumption is temporary battle state, not permanent inventory deletion.
- Additional copies can only come from an explicit encounter reward, such as Snorlax's Leftovers.
- An individual holder's death after a win does not delete the owned held item.
- A full wipe deletes the run's inventory and resets purchase restrictions.
- Items cannot currently be sold. Selling may be reconsidered later but is not part of the present item loop.
- Thief and Covet permanently take an opponent's held item when the user's Pokémon entered battle without an item.
- Trick and Switcheroo are temporary when the user's Pokémon entered battle holding an item: its original owned item is restored after battle, even if it was given away and no item was received in return.
- Trick and Switcheroo permanently take the received item when the user's Pokémon entered battle without an item.
- Item-stealing abilities such as Magician and Pickpocket follow the same empty-handed rule. Delphox and Klefki can have Magician; Barbaracle, Grimmsnarl, Shiftry, Tinkaton, and Weavile can have Pickpocket in the approved roster.
- Persisted stolen items are added to inventory and equipped to the Pokémon that acquired them. Battle settlement is idempotent, so reloading or replaying a completed battle cannot grant the same item twice.
- Recycle restores an item consumed during the current battle only. Because held-item consumption is temporary, it does not change post-battle inventory.
- Knock Off removes the opponent's item for the current battle. Trainer item loss requires no persistence because each trainer battle is a one-off for that player.

### Snorlax and Leftovers

- Every encountered Snorlax arrives holding Leftovers.
- Shop-purchased Leftovers remains subject to the one-purchase-per-run restriction.
- A Snorlax-provided copy bypasses that restriction, making repeated Snorlax encounters the only approved path to multiple Leftovers in one run.
- No special anti-farming limit is required; the strategy is sufficiently rare and inefficient.

### Initial economy and prices

- A fresh monthly run starts with ₽50,000.
- Vitamins cost ₽10 per EV and EV-reduction berries cost ₽8 per EV. Fully allocating 510 EVs therefore costs ₽5,100 before reductions.
- Bottle Caps cost ₽900 each; Nature Mints ₽1,500; Ability Capsules ₽2,000; Ability Patches ₽3,000; and the Rotom Catalog ₽2,000.
- Each Nectar costs ₽750 and each Paldean Tauros Cud costs ₽1,000.
- Premium held items cost ₽2,500: Assault Vest, Booster Energy, Choice Band, Choice Scarf, Choice Specs, Covert Cloak, Focus Sash, Heavy-Duty Boots, Leftovers, Life Orb, Loaded Dice, and Rocky Helmet.
- Strong held items cost ₽1,800. Most other reusable held items cost ₽1,400 and other battle-consumable held items cost ₽1,200.
- Most Berries cost ₽600; Sitrus, Lum, and Custap Berries cost ₽1,000.
- Type Memories and ordinary single-type power boosters cost ₽750.

These are first-pass balance values and live in the content layer so playtesting can tune them without changing inventory rules. Battle payouts, sale values, and special rewards remain **Deferred**.

## 10. Moves and TMs

- Eligible moves in an approved Pokémon's Pokémon Showdown learnset are available as TMs. TMs replace level-up, egg, tutor, HM, and conventional limited-TM move-learning paths.
- Every Pokémon remains level 100. Newly encountered Pokémon receive a randomly generated battle-ready moveset from their direct Showdown learnset; that result is persisted and never rerolled on refresh.
- Each ordinary type receives one damaging STAB slot. Eligible STAB normally requires at least 60 effective base power and 70% accuracy. Bullet Punch for Scizor and Accelerock for Midday/Dusk Lycanroc are the only explicit sub-60-BP priority exceptions. If a species has no qualifying move for a type, the generator falls back to a weaker legal damaging STAB with at least 70% accuracy.
- STAB choices are weighted toward 75–100 effective base power, while 60–74 BP moves such as Aerial Ace remain viable with moderately lower weight. Accuracy scales selection weight literally: a 70%-accurate move receives 70% of the weight of an otherwise equivalent perfectly accurate move. Physical and special moves are also weighted toward the species's stronger attacking stat. Thunder and Fire Blast remain possible while attacks below 70% accuracy do not generate normally.
- Dual-type Pokémon ordinarily receive one damaging STAB move for each type. Pyukumuku, Wobbuffet, Ditto, and Unown are explicit exceptions because their legal learnsets do not provide conventional damaging STAB for every type. Revelation Dance supplies Oricorio's non-Flying STAB according to its battle behavior.
- Setup moves remain eligible for naturally generated encounter movesets even though setup moves are excluded from the TM catalog.
- Approved guaranteed signature moves fill their natural STAB slot if selected there; otherwise they occupy the first available plain slot. Optional signature-pool moves participate normally without being forced.

Guaranteed signatures currently include Hyper Fang (Raticate), Shell Side Arm (Galarian Slowbro), Raging Bull (all Tauros), Leaf Blade (Sceptile), Needle Arm (Cacturne), Weather Ball (Castform), Horn Leech (Sawsbuck), Gear Grind (Klinklang), Esper Wing (Hisuian Braviary), King's Shield (Aegislash), Topsy-Turvy (Malamar), Flying Press (Hawlucha), Forest's Curse (Trevenant), Trick-or-Treat (Gourgeist), Spirit Shackle (Decidueye), Triple Arrows (Hisuian Decidueye), Darkest Lariat (Incineroar), Beak Blast (Toucannon), Ice Hammer (Crabominable), Revelation Dance (Oricorio), Pollen Puff (Ribombee), Accelerock (Midday/Dusk Lycanroc), Baneful Bunker (Toxapex), Trop Kick (Tsareena), Shore Up (Palossand), Multi-Attack (Silvally), Zing Zap (Togedemaru), Anchor Shot (Dhelmise), Aura Wheel (Morpeko), Stone Axe (Kleavor), Bullet Punch (Scizor), Torch Song (Skeledirge), Aqua Step (Quaquaval), Flower Trick (Meowscarada), Double Shock (Pawmot), Population Bomb (Maushold), Salt Cure (Garganacl), Gigaton Hammer (Tinkaton), Matcha Gotcha (Sinistcha), Electro Shot (Archaludon), Jet Punch (Palafin), Triple Dive (Wugtrio), Spin Out (Revavroom), and Fillet Away (Veluza).

Optional signature-pool moves currently include Volt Tackle (Raichu), Crabhammer (Kingler), Bonemerang/Bone Club (Marowak), Shadow Bone (Alolan Marowak), Blaze Kick (Blaziken), Muddy Water (Swampert), Heat Crash (Emboar), Ceaseless Edge (Hisuian Samurott), Night Daze (Zoroark), Fire Lash (Salazzle), Clanging Scales (Kommo-o), Dire Claw (Sneasler), and Kowtow Cleave (Kingambit).
- A Pokémon may only use a TM for a move in its own Showdown learnset. Teaching a move replaces one of its current four moves.
- TMs are repeatable purchases and are consumed only after a legal move change succeeds.
- Damaging moves begin at ₽16 per point of effective base power. Major-status secondary effects add ₽5 per percentage point, capped at ₽900. One-stage stat drops add ₽1 per percentage point and drops of two or more stages add ₽2 per percentage point. Accuracy below 100% subtracts ₽10 per percentage point. Damaging priority moves add a flat ₽500 regardless of priority bracket. Any chance to raise the user's stats adds ₽10 per percentage point, and draining moves add ₽10 per percentage point of damage recovered. Recoil, recharge turns, two-turn attacks, self-drops, and exceptional utility apply small adjustments. The result has a ₽500 floor and always rounds up to the nearest ₽50.
- Fixed-hit multihit moves use their total base power. Variable two-to-five-hit moves use 3.5 hits, their expected average. Electro Ball and Gyro Ball cost ₽1,000 rather than attempting to estimate their variable damage.
- Manual exceptions override the formula where move mechanics make its estimate misleading: Population Bomb costs ₽2,400; Aura Wheel, Focus Punch, and Last Resort cost ₽1,800; Rapid Spin costs ₽1,300; and Dream Eater costs ₽1,100.
- The catalog uses direct learnsets inherited through a Pokémon's evolutionary family. Sketch does not make every sketchable move a TM through Smeargle; a move is omitted when no approved Pokémon directly learns it.
- Smeargle is excluded from the approved player, trainer, and encounter roster.
- Protect, Detect, Baneful Bunker, King's Shield, Spiky Shield, and their close equivalents cost ₽2,000. Recover and its direct equivalents also cost ₽2,000, while weather-dependent Synthesis, Morning Sun, and Moonlight cost ₽1,750. Reflect and Light Screen cost ₽1,350. Weather and terrain setters cost ₽1,200. Perish Song costs ₽2,000. Generally strong and accurate status moves such as Thunder Wave cost ₽1,000; useful but unreliable or conditional moves such as Sleep Powder cost ₽750; ordinary niche status moves cost ₽500; low-value moves such as Growl cost ₽250; and Splash costs ₽100.
- Pure stat-boosting status moves are excluded, including Swords Dance, Dragon Dance, Nasty Plot, Calm Mind, Bulk Up, Quiver Dance, Shell Smash, Tail Glow, Belly Drum, Shift Gear, Victory Dance, Geomancy, No Retreat, Clangorous Soul, Coil, Iron Defense, Amnesia, Agility, and Rock Polish. Spore, Revival Blessing, Shed Tail, Baton Pass, Minimize, and Double Team are also excluded.

Training items and TMs are consumed after a successful use and may be purchased repeatedly. Generated moves and later TM changes are persisted so refreshes cannot reroll or undo them.

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
- Randomly chooses a living replacement when a pivot move or forced replacement requires one.
- Uses damaging priority when the faster player Pokémon threatens a possible KO, with failed Sucker Punch attempts suppressed for the rest of the battle.
- Then prefers guaranteed KOs, contextually useful moves, and the active Pokémon's first useful status move.
- Next prefers possible KOs, followed by the highest ordinary damage; moves within 10% of the best estimate are selected randomly.
- Later status uses rank below ordinary damage, while ineffective or immune choices rank last.
- Damage-roll decisions ignore critical hits.
- Cannot use bag items.
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
