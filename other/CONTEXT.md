# Nuzzle — Project Context

Last updated: October 25, 2026

## Vision

Nuzzle is a mobile-first daily Pokémon challenge built around preparation, attachment, and consequence. Every player faces the same trainer each day, but builds a personal run through random encounters, team construction, training, TMs, held items, and permanent losses.

The target experience is closer to Pokémon Showdown than a conventional Pokémon RPG: quick to enter, mechanically legible, and focused on team decisions rather than exploration or leveling. The interface should remain simple and restrained—plain typography, familiar sprites, compact panels, and details shown on demand. It should fit naturally on a phone without routine page scrolling; contained lists may scroll where the content genuinely requires it.

The central loop is:

1. Inspect today's shared trainer and team.
2. Claim available encounters and prepare a six-Pokémon team.
3. Spend limited money on moves, training, and held items.
4. Commit to one official battle for the day.
5. Keep survivors, permanently lose casualties, and continue the run—or wipe and rebuild.

## Start Here

Use these documents in this order:

1. **This file** — quick orientation to the current product and its history.
2. [`docs/INFO.md`](docs/INFO.md) — canonical owner-approved game rules and balance decisions.
3. [`data/nuzzle-approvals.csv`](data/nuzzle-approvals.csv) — approved Pokémon and item content.
4. [`docs/pokemon-daily-game-spec.md`](docs/pokemon-daily-game-spec.md) — older design history and detailed proposals; it loses to `INFO.md` when they conflict.
5. [`README.md`](README.md) and [`../backend/README.md`](../backend/README.md) — repository setup and backend notes.

When documentation and executable behavior disagree, verify the code and tests before changing anything. Some older prose describes planned rather than current behavior.

## Current Player Experience

### Landing page

- Shows the current Nuzzle number, trainer name, game date, rollover countdown, and the day's full trainer team.
- Provides navigation to Battle, PC, Bag, Encounters, Mart, Leaderboard, and Settings.
- Logged-out users can view the landing page; entering tracked sections opens the login card.
- The header contains a remembered light/dark theme switch and account/avatar control.
- The layout is designed to fit compact mobile viewports, including iPhone and Android browser chrome.

### Accounts and profiles

- Username/password registration and login are implemented.
- Passwords use scrypt hashes; sessions use persistent 30-day HttpOnly cookies.
- Accounts default to a Pokémon Showdown trainer avatar, which can be changed from the account view.
- The theme is stored per device and defaults to light. Dark mode uses `#121212`.
- The configured administrator account has trainer scheduling and daily-attempt reset controls.
- There is no email, password recovery, or custom image upload in the beta.

### Encounters

- A fresh run starts with zero Pokémon and twelve individually revealed encounter cards.
- The first opening encounter is a guaranteed fully evolved starter; later opening results are drawn normally.
- After the opening set, players receive three encounters per day or four on Sunday.
- Results are generated and persisted server-side before reveal, so refreshes cannot reroll them.
- A claimed result remains visible for that visit, then disappears from the encounter screen after leaving.
- The list scrolls inside a contained region while the surrounding mobile screen stays stable.
- Duplicate-family and grouped-form rules follow `INFO.md`.

### PC

- Displays today's trainer team first as a reference, then the player's active team, then boxed Pokémon.
- A Pokémon appears in either Team or Box, never both.
- Supports team addition/removal and drag reordering.
- The detail drawer shows identity, types, ability, nature, held item, calculated stats, and an IV/EV tab.
- Held items can be given or taken without closing the item view; the Bag and holder update immediately.
- Training items and TMs are applied from the Pokémon detail flow.

### Bag and Mart

- Both use Held Items, Training Items, and TMs tabs.
- The Bag shows owned inventory and contextual use/equip actions. Selling is not implemented.
- The Mart shows a compact item list with optional information and a purchase drawer.
- Stackable items use a mobile quantity selector that shows money, quantity, and total price.
- Held items are normally limited to one shop purchase per run; Training Items and TMs are consumable and repurchasable.
- Fresh runs begin with ₽50,000; a daily win awards ₽15,000.
- Current price rules and exceptions are recorded in `INFO.md` and implemented in the content layer.

### Battle preview and battle

- The player sees the trainer's team and selects a lead from a compact six-sprite row.
- Selecting a lead exposes a compact Showdown-style summary with ability, held item, all six stats, and moves.
- Battles are Generation 9 Custom Game singles powered by Pokémon Showdown.
- The battle screen includes the arena, compact HP panels, move buttons, six switch buttons, a contained battle log, tooltips/long-press information, and Give Up.
- Battle state is server-authoritative and can resume after refresh.
- The opponent uses deterministic rule-based move selection: priority against a threatened faster foe, guaranteed KOs, situational utility, first useful status use, possible KOs, strongest damage within a 10% choice band, later status uses, then ineffective choices.
- Trainers do not voluntarily switch; forced and pivot replacements are random.

### Results, death, and wipes

- Each account gets one official attempt per game date.
- On a win, every Pokémon that fainted is permanently removed; boxed Pokémon remain safe.
- A dead holder's owned held item remains available in the Bag.
- Casualties are matched to roster Pokémon by original identity, not mutable Showdown team position.
- A loss or forfeit wipes the entire roster, money, and run inventory immediately, creates a fresh run with opening encounters and ₽50,000, and leaves that day's attempt spent.
- Surviving teams heal freely between daily battles.

### Leaderboards

- The **Streak** tab ranks accounts by consecutive daily wins and includes zero-day streaks.
- The **Daily** tab ranks completed attempts by fewest casualties, breaking ties by earliest completion.
- Daily rows show rank, account/avatar, the battle team, green survivors, red casualties, and losses.

### Trainer administration

- Admin tooling supports a queued daily trainer schedule and immutable published daily snapshots.
- Trainer sets are imported in Showdown format with explicit species, ability, nature, IVs, EVs, moves, items, gender, and shiny state.
- The PC and landing page expose the current trainer team so players can prepare against it.

## Important Game Rules

- All player Pokémon are level 100; there is no leveling or evolution loop.
- Encounters have random IVs, zero EVs, random nature, a random ordinary ability, normal gender odds, and a `1/4096` shiny chance.
- Generated movesets guarantee qualifying damaging STAB for each type and obey required/preferred signature-move rules.
- Setup moves may generate naturally, but setup TMs are excluded.
- TMs are the universal move-learning system and cover legal learnset moves that pass the approved exclusions.
- Form families, encounter weights, form-changing items, ability items, EV/IV items, TM pricing, and signature moves are detailed in `INFO.md`.
- Battle gimmicks such as Mega Evolution, Z-Moves, Dynamax, and Terastallization are disabled.
- Bag items cannot be used during battle.
- The game date rolls over at midnight in `America/New_York`.

## Technical Shape

- `frontend/` is a framework-free HTML/CSS/JavaScript single-page mobile UI.
- `backend/server.js` serves the frontend and JSON API.
- `backend/game-store.js` owns runs, encounters, rosters, teams, money, inventory, purchases, and training.
- `backend/battle-service.js` owns Showdown battle sessions, commands, AI, results, casualties, and item acquisition.
- `backend/trainer-store.js` owns trainer drafts, scheduling, and published daily opponents.
- `backend/auth-store.js` owns accounts and sessions.
- `backend/content.js` builds validated content from the approvals snapshot and Showdown data.
- Backend tests cover authentication, content validation, encounters, economy, persistence, trainer scheduling, AI, battles, permadeath, wipes, and leaderboards. Browser checks cover major mobile flows.

Production currently runs from private GitHub `main` on a small DigitalOcean Ubuntu Droplet, served at <https://nuzzle-game.duckdns.org>. A GitHub Actions workflow deploys pushes to `main`, keeps only the current release on the VM, and restarts the service. Nginx/HTTPS fronts a Node service bound to localhost.

Persistent production state currently uses private JSON files under `/var/lib/nuzzle`; local state defaults beneath `backend/data/`. This is adequate for the small beta but is not a transactional multi-instance database. Treat the VM data directory as irreplaceable player state and preserve it across deployments.

## High-Level Evolution

1. **Concept and static prototype** — Established the shared daily-trainer loop, mobile navigation, restrained Showdown-inspired visual language, PC, encounters, item screens, and battle mockups.
2. **Real battle slice** — Added Pokémon Showdown as the rules engine, playable singles battles, local sprites and arena assets, battle logs, move/switch controls, information cards, and responsive positioning.
3. **Accounts and persistent runs** — Added registration, login, persistent sessions, themes, account-scoped rosters, teams, encounters, money, inventory, and battle ownership.
4. **Approved content and economy** — Imported the curated Pokémon/item approvals, implemented forms and duplicate families, encounter move generation, the full eligible TM catalog, training actions, held-item rules, quantity purchasing, and first-pass pricing.
5. **Mobile UX refinement** — Reworked drawers, stat/IV/EV views, lead selection, battle HUD sizing, sprite anchoring, contained scrolling, dark-mode colors, mobile browser-height handling, and compact landing headers.
6. **Production deployment** — Moved the private full stack to a DigitalOcean VM with HTTPS, DuckDNS, SSH-based administration, automated `main` deployment, swap, monitoring, and release cleanup.
7. **Daily game operations** — Added persisted daily trainers, admin scheduling/import tools, one-attempt enforcement, result sharing, midnight rollover, trainer previews, shiny trainer Pokémon, and admin attempt resets.
8. **Run consequences and rewards** — Added ₽15,000 wins, permanent individual casualties, full loss/forfeit wipes, immediate fresh-run encounters, retained held-item ownership after individual deaths, and identity-safe casualty settlement.
9. **Competitive context** — Added daily and streak leaderboards, losses and zero-day streaks, trainer-sprite account avatars, and survivor/casualty team displays.

## Current Priorities and Cautions

- Continue authoring and balancing daily trainers; the game systems are substantially ahead of the trainer-content library.
- Observe economy, encounter quality, TM prices, AI behavior, and mobile fit through real play rather than prematurely locking balance.
- Migrate production persistence to a durable transactional database before the audience or write volume grows materially.
- Add recovery/backup procedures, migrations, operational logging, and account recovery before a broader launch.
- Preserve server authority and idempotency. Encounter claims, purchases, item use, battle settlement, rewards, deaths, and wipes must remain safe across refreshes and retries.
- Never infer roster eligibility from all Pokémon Showdown species. The approvals CSV is intentional.
- Avoid species-specific layout fixes. Sprite and mobile positioning should use general rules that work across the roster.
- Keep primary mobile screens compact. Prefer drawers, tabs, tooltips, long press, and contained list scrolling over making the whole application page scroll.

## Development Workflow

From the repository root:

```bash
nvm use
npm install
npm run dev
npm test
npm run test:browser
```

Work from `main` for the current beta unless the owner explicitly introduces another branch. Preserve unrelated local files and production data. Normal completed changes should be tested, committed, and pushed so the live phone build can be checked promptly.
