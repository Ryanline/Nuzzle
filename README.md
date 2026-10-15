# Nuzzle

Nuzzle is a calm, daily monster-battling puzzle inspired by Nuzlocke rules: build a persistent roster, prepare for a shared daily trainer, and live with every casualty.

This repository currently contains the first interactive product slice. It focuses on the daily-trainer presentation, persistent fresh-run encounters, party management, and a small prototype shop. The official battle engine and server-authoritative persistence are intentionally held behind documented product decisions rather than approximated in client code.

## Run locally

The prototype is buildless. Open `index.html` directly, or serve the repository with any static file server.

```powershell
python -m http.server 4173
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

## Attribution and status

This is an independent fan project and is not affiliated with or endorsed by Nintendo, Game Freak, Creatures, or The Pokémon Company. Creature sprites are loaded from Pokémon Showdown's public sprite host for development preview purposes; launch licensing and asset review remain outstanding.

