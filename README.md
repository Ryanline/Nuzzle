# Nuzzle UI prototype

This repository is a frontend-only, clickable prototype based on the supplied visual reference.

## Open it

Double-click `index.html`. No server, database, package installation, or build step is required.

The prototype includes:

- Daily opponent landing page
- Lead selection and a lightweight clickable battle mockup
- Showdown-style move and Pokémon information on hover
- Long-press information cards on touch devices without triggering the underlying action
- A party-selecting and rearrangeable PC box
- Three independently revealable encounters and a temporary reveal-all control
- Local arena and sprite assets

The battle is intentionally UI-only. Move selection changes the mock HP and turn display but does not use a simulator or backend.

## Optional QA

For maintainers with Node.js installed:

```powershell
npm.cmd install
npm.cmd test
```
