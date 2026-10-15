# Nuzzle

Nuzzle is a calm, daily monster-battling puzzle inspired by Nuzlocke rules: build a persistent roster, prepare for a shared daily trainer, and live with every casualty.

This repository currently contains the first interactive product slice. It focuses on the daily-trainer presentation, persistent fresh-run encounters, party management, and a small prototype shop. The official battle engine and server-authoritative persistence are intentionally held behind documented product decisions rather than approximated in client code.

## Run locally

The prototype is buildless. Open `dist/index.html` directly, or serve the `dist` directory with any static file server.

```powershell
python -m http.server 4173 --directory dist
```

Then visit `http://localhost:4173`.

> The current machine does not have a working Python or Node runtime on `PATH`; the command above is the expected setup once either runtime is installed.

## What works

- Responsive Today, Encounters, PC, Shop, and Records views
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

The planned local stack is a browser frontend, a Node.js/TypeScript API containing Pokémon Showdown, and PostgreSQL. The frontend and API will run on localhost while development continues. Keeping deployable services separated from machine-specific configuration will allow the frontend to move to GitHub Pages and the API/database to managed hosts later without rewriting game logic.

## Battle backend

The current browser prototype has no backend and cannot safely run official battles. The proposed local-first service boundary, persistence model, simulator lifecycle, and implementation milestones are documented in [docs/battle-backend.md](docs/battle-backend.md).

## Attribution and status

This is an independent fan project and is not affiliated with or endorsed by Nintendo, Game Freak, Creatures, or The Pokémon Company. Creature sprites are loaded from Pokémon Showdown's public sprite host for development preview purposes; launch licensing and asset review remain outstanding.

