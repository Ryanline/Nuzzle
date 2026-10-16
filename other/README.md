# Nuzzle

Nuzzle is a mobile-first daily monster-battling puzzle. The current build is a frontend-only, clickable prototype based on the supplied design reference.

## Repository layout

- `frontend/` — the local HTML/CSS/JavaScript prototype, image assets, and UI checks
- `backend/` — reserved for the future API, battle service, and persistence layer
- `other/design/` — the current PDF design reference
- `other/docs/` — product and game specifications

## Open it

Double-click `frontend/index.html`. No server, database, package installation, or build step is required.

The prototype includes:

- Daily opponent landing page
- Lead selection and a lightweight clickable battle mockup
- Showdown-style move and Pokémon information on hover
- Long-press information cards on touch devices without triggering the underlying action
- A party-selecting and rearrangeable PC box
- Three independently revealable encounters
- Clickable bag, mart, leaderboard, and settings views
- A mart prototype with working local purchases
- Local arena and sprite assets

The battle is intentionally UI-only. Move selection changes the mock HP and turn display but does not use a simulator or backend.

## Optional QA

For maintainers with Node.js installed, run the checks from the frontend folder:

```powershell
cd frontend
npm.cmd install
npm.cmd test
```
