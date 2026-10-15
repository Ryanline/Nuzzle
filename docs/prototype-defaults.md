# Prototype defaults and decision gates

Last updated: October 15, 2026

These choices exist only to make the browser prototype testable. They do not resolve the specification's open-decision register.

## Temporary prototype defaults

- Fresh-run encounters replace the day's ordinary encounters (proposed default from D05).
- Encounter selection is uniform over all 146 eligible Generation 1 species; Articuno, Zapdos, Moltres, Mewtwo, and Mew are excluded.
- Move selection is uniform within each candidate pool (proposed default from D04).
- Prototype movesets are generated deterministically from the pinned Pokémon Showdown learnset data.
- Browser-local state is scoped to one anonymous profile and one browser.
- Prototype shop values start at ₽2,400 and use clearly labeled placeholder prices.
- Game-date presentation uses `America/New_York` only for the static prototype.

## Decisions needed before the next subsystem

The prototype now has a playable in-memory battle loop. Before making it the official daily attempt, decide:

1. D01: mechanics generation/format, Pokémon Showdown version, learnset policy, and whether special mechanics are disabled.
2. D03: initial IVs, EVs, natures, and abilities.
3. D06: global game timezone and rollover/cross-midnight behavior.
4. D12: trainer AI policy and whether opponent abilities are visible.
5. D13: forfeit, draw, timeout, and abandoned-battle handling.
6. D17: account provider, database, hosting, and guest-account behavior.

## Production boundary

The static prototype is not secure gameplay infrastructure. Before public play, encounter generation, daily challenges, inventory, currency, roster updates, and official battle actions must be moved behind authenticated server endpoints. Client storage must never decide an official outcome.

