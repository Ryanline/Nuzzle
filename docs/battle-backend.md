# Battle backend plan

The current `dist/` application is a browser-only product prototype. Its local-storage state is useful for testing the flow, but it is not authoritative and must not decide official encounters, currency, attempts, deaths, or wins.

## Recommended first production shape

Use one TypeScript/Node.js application service with PostgreSQL and the pinned `pokemon-showdown` package. During development, serve the client and API on localhost and run PostgreSQL locally. The API can start as one deployable service; no microservices or full Pokémon Showdown community server are needed.

Keep environment-specific values in ignored `.env` files and make browser/API origins configurable. Later, the same built frontend can move to GitHub Pages while the API and PostgreSQL move to managed hosts.

The Showdown package currently exposes a Node-only `BattleStream`. The backend starts a stream with the approved format and frozen teams, submits player and AI choices, parses the simulator protocol, and returns only information the player is allowed to see.

```text
Local browser client
        |
        | HTTPS + authenticated player session
        v
Nuzzle API (Node.js)
   |          |
   |          +-- Pokémon Showdown BattleStream
   |
   +------------- PostgreSQL
```

## Server-owned data

- User identity and lifetime records
- Current run, living roster, party, inventory, and money ledger
- One persisted shared opponent snapshot per game date
- Individual persisted encounter claims and generated moves
- One official attempt per user/game date
- Frozen player and opponent teams at battle commitment
- Simulator version, rules version, random seed, accepted choices, and battle transcript
- Idempotent battle finalization, deaths, rewards, wipes, and streak updates

## Battle request lifecycle

1. `POST /attempts` validates the game date and party, creates the unique user/date attempt, and freezes both teams.
2. The server starts or reconstructs the Showdown simulation from the frozen snapshot, pinned version, seed, and accepted action log.
3. `GET /attempts/:id` returns the public battle projection and the player's legal choices.
4. `POST /attempts/:id/actions` accepts an idempotency key and one legal move or switch.
5. The AI selects from information available before the player's current choice is revealed, then the server submits both choices to Showdown.
6. The server stores the accepted choice and resulting protocol events transactionally and returns a sanitized event list.
7. On battle end, one transaction applies casualties, healing, rewards or wipe, streak changes, and attempt finalization exactly once.

Player-versus-AI turns can use ordinary HTTPS request/response initially. WebSockets are optional polish, not a prerequisite.

## Decisions required before implementation

These specification decisions block an honest battle implementation:

- **D01:** mechanics generation/format, pinned Showdown version, learnset policy, and enabled special mechanics.
- **D03:** IVs, EVs, natures, abilities, and stat generation.
- **D06:** authoritative game timezone and cross-midnight behavior.
- **D12:** AI policy and whether opponent abilities are visible.
- **D13:** forfeits, draws, timeouts, abandoned battles, and exceptional losses.
- **D17:** accounts, database, API hosting, and guest-account policy.

Recommended first-playable defaults for owner approval:

- Generation 9 mechanics and current compatible learnsets.
- No Mega Evolution, Z-Moves, Dynamax, or Terastallization.
- Level 100, 31 IVs, 0 EVs, neutral natures, and the species' first standard ability.
- `America/New_York` date rollover; an attempt started before rollover may finish against its frozen challenge.
- A deterministic heuristic AI that sees public battle state but never the player's current choice.
- Explicit forfeit counts as a loss; transient disconnect does not. No clock in the first playable.
- Email/social account required for official progress; no durable anonymous guest runs.

## Delivery milestones

1. Install Node.js 22+ and PostgreSQL (directly or through Docker), then scaffold the TypeScript API, tests, schema, and local environment.
2. Pin Pokémon Showdown and prove one fixture battle through `BattleStream` with legal moves and switches.
3. Implement the encounter/move generator as tested server-side domain logic.
4. Add accounts, daily challenge persistence, run state, and the unique user/date attempt constraint.
5. Implement resumable battle actions and the simple documented AI.
6. Finalize results transactionally and connect the existing UI to the API.
7. Test refreshes, retries, two tabs, month boundaries, losses, and simulator reconstruction.

## Later deployment boundary

The browser must obtain its API base URL from configuration rather than assuming `localhost`. The API must use explicit CORS origins, secure cookies or bearer sessions, database migrations, and environment-provided secrets. With those boundaries in place, moving the static build to GitHub Pages and changing the API/database URLs is configuration work rather than a redesign.

