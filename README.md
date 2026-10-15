# Nuzzle

Nuzzle is a calm, daily monster-battling puzzle inspired by Nuzlocke rules: build a persistent roster, prepare for a shared daily trainer, and live with every casualty.

This repository contains the first playable product slice: daily-trainer preparation, persistent fresh-run encounters, party management, a prototype shop, and turn-by-turn battles powered by Pokémon Showdown.

## Run locally

Install Node.js 22+ and make Docker available. This checkout uses Node.js on Windows and Docker Engine in Ubuntu WSL.

```powershell
npm.cmd install
npm.cmd run db:up
npm.cmd run dev
```

Open a new PowerShell window first so it picks up the Node.js path added during setup. Using `npm.cmd` avoids PowerShell execution-policy conflicts with `npm.ps1`.

Then visit `http://127.0.0.1:3000`. The same local process serves the static frontend and the `/api` routes.

The Battle flow is playable: choose moves or switch party members in a Showdown-style interface while the local API owns the simulator session and selects the trainer's actions. Battle sessions are currently held in server memory and do not yet consume the daily attempt or apply Nuzlocke deaths to the roster.

## What works

- Responsive Today, Encounters, PC, Shop, and Records views
- All 146 non-legendary and non-mythical Generation 1 species
- Playable, turn-by-turn Pokémon Showdown battles with moves, PP, HP, switching, forced switches, and results
- Calendar-aware trainer tier and finale labeling
- A persisted 10-creature fresh-run package with a fully evolved starter first
- Duplicate-safe encounter batches
- Spec-shaped move generation: STAB guarantees, top-three cutoff ties, and three damaging moves where possible
- Party selection capped at six and persisted in browser storage
- A restrained, accessible interface with opponent moves and held items inspectable on demand
- Prototype economy interactions, visibly marked as unapproved balance values

## Architecture direction

The browser prototype deliberately uses local storage only. Production gameplay must move game dates, encounters, economy, attempts, and battle outcomes to a server-authoritative application with transactional persistence. See [docs/prototype-defaults.md](docs/prototype-defaults.md) for the temporary assumptions and blockers.

The product specification remains the source of truth: [pokemon-daily-game-spec.md](pokemon-daily-game-spec.md).

## Local development

Nuzzle is intentionally local-only during initial development. There is no active GitHub Pages workflow and pushes to `main` do not deploy the site.

The local stack is a browser frontend, a Node.js/TypeScript API containing Pokémon Showdown, and PostgreSQL. The frontend and API run on localhost while development continues. Keeping deployable services separated from machine-specific configuration will allow the frontend to move to GitHub Pages and the API/database to managed hosts later without rewriting game logic.

## Battle backend

The backend now exposes an in-memory interactive Pokémon Showdown battle session in addition to the original persistence fixture. It validates Kanto parties, returns only legal choices, and advances the opponent after each player action. Durable attempts, reconnect support, and transactional Nuzlocke consequences remain the next server milestone. The service boundary and persistence plan are documented in [docs/battle-backend.md](docs/battle-backend.md).

## Attribution and status

This is an independent fan project and is not affiliated with or endorsed by Nintendo, Game Freak, Creatures, or The Pokémon Company. Creature sprites are loaded from Pokémon Showdown's public sprite host for development preview purposes; launch licensing and asset review remain outstanding.

