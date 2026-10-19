# Nuzzle

Nuzzle is a mobile-first daily monster-battling puzzle. The current build is a frontend-only, clickable prototype for exploring its primary interface and interactions.

## Product vision

Nuzzle is built around one shared opponent each day. Players prepare individualized teams through encounters, roster management, training, held items, and TMs before committing to one consequential battle.

The interface is intentionally simple, practical, and restrained. It uses clear typography, generous spacing, familiar sprites, and lightweight game-like shapes without recreating the visual shell of an official Pokémon game. Detailed information and secondary actions appear on demand rather than crowding each screen.

## Core flow

1. View and inspect the daily opponent.
2. Optionally reveal encounters and add them to the PC.
3. Inspect Pokémon, manage the team, and apply items through the PC.
4. Buy and organize Held Items, Training Items, and TMs.
5. Choose a lead and begin the daily battle.
6. Eventually receive results, casualties, rewards, and streak changes.

Players can prepare in whichever order makes sense before starting the battle. The deeper game rules and planned backend behavior live in [`docs/pokemon-daily-game-spec.md`](docs/pokemon-daily-game-spec.md).

## Repository layout

- `frontend/` — the local HTML/CSS/JavaScript prototype, image assets, and UI checks
- `backend/` — reserved for the future API, battle service, and persistence layer
- `other/docs/` — the living product and game specification

## Open it

Double-click `frontend/index.html`. No server, database, package installation, or build step is required.

The prototype includes:

- Daily opponent landing page
- Lead selection and a lightweight clickable battle mockup
- Showdown-style move and Pokémon information on hover
- Long-press information cards on touch devices without triggering the underlying action
- A party-selecting and rearrangeable PC box with Pokémon details, team swapping, and item use
- Three independently revealable encounters with clear mystery and revealed states
- Categorized Bag and Mart views for Held Items, Training Items, and TMs
- Working local purchases and contextual give, use, and teach actions
- Clickable leaderboard and settings placeholders
- Local arena and sprite assets

The battle is intentionally UI-only. Move selection changes the mock HP and turn display but does not use a simulator or backend.

## Optional QA

For maintainers with Node.js installed, run the checks from the frontend folder:

```powershell
cd frontend
npm.cmd install
npm.cmd test
```
