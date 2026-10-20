# Nuzzle

Nuzzle is a mobile-first daily monster-battling puzzle with a working local account system and Pokémon Showdown-backed battle slice.

## Product vision

Nuzzle is built around one shared opponent each day. Players prepare individualized teams through encounters, roster management, training, and held items before committing to one consequential battle.

The interface is intentionally simple, practical, and restrained. It uses clear typography, generous spacing, familiar sprites, and lightweight game-like shapes without recreating the visual shell of an official Pokémon game. Detailed information and secondary actions appear on demand rather than crowding each screen.

## Core flow

1. View and inspect the daily opponent.
2. Begin a fresh run by claiming a twelve-Pokémon opening encounter, then reveal the remaining daily encounters.
3. Inspect Pokémon, manage the team, and apply items through the PC.
4. Buy and organize Held Items and Training Items. TMs remain deferred.
5. Choose a lead and begin the daily battle.
6. Eventually receive results, casualties, rewards, and streak changes.

Players can prepare in whichever order makes sense before starting the battle. Current approved rules live in [`docs/INFO.md`](docs/INFO.md); the curated content approvals live in [`data/nuzzle-approvals.csv`](data/nuzzle-approvals.csv).

## Repository layout

- `frontend/` — the local HTML/CSS/JavaScript prototype, image assets, and UI checks
- `backend/` — the local API, account/session storage, and Showdown battle service
- `other/docs/` — canonical rules plus supporting design history
- `other/data/` — reviewed content approvals used to build application data

## Open it

From the repository root, install dependencies and run `npm run dev`, then open <http://127.0.0.1:3000>.

The prototype includes:

- Daily opponent landing page
- Lead selection and a working Showdown-backed battle
- Showdown-style move and Pokémon information on hover
- Long-press information cards on touch devices without triggering the underlying action
- A party-selecting and rearrangeable PC box with Pokémon details, team swapping, and item use
- Three daily encounters, or four on Sunday, with a persisted twelve-Pokémon opening batch for fresh runs
- The complete approved catalog of 523 encounter entries, 139 Held Items, and 24 Training Items
- Persistent account-scoped rosters, teams, encounters, money, inventory, purchases, equipment, and training
- Categorized Bag and Mart views for Held Items and Training Items; TMs are intentionally absent for now
- Working purchases and contextual held-item and training-item actions
- Account/profile controls, persistent sessions, theme selection, and leaderboard/settings placeholders
- Local arena and sprite assets

Local JSON files beneath `backend/data/` are development storage. They should be replaced by a durable transactional database before public deployment.

## Optional QA

For maintainers with the repository's Node version installed, run from the repository root:

```bash
npm install
npm test
npm run test:browser
```
