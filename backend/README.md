# Backend

The local backend serves the frontend and owns Pokémon Showdown battle sessions.

From the repository root:

```bash
nvm use
npm install
npm run dev
```

Open <http://127.0.0.1:3000>. Accounts, login sessions, run state, and battle records are
written beneath `backend/data/` and are intentionally excluded from Git. Set
`PORT`, `HOST`, or `NUZZLE_DATA_DIR` to override the local defaults.

Register or log in from the account button in the top-right corner. Sessions
use a 30-day HttpOnly cookie, so a browser stays signed in without storing an
authentication token in frontend JavaScript. Passwords are hashed with scrypt.
This JSON-backed account store is suitable for local development and can be
replaced by a hosted database before deployment; it is not the final production
account system and currently has no email recovery flow.

Profiles default to Showdown's `unknownf` trainer avatar. Players can choose any trainer sprite from their account card, and the selected avatar appears on leaderboards.

The current battle slice uses Generation 9 Custom Game mechanics. Generated
player Pokémon are level 100 with random IVs, zero EVs, a random nature, and a
random ordinary ability. Brock retains the temporary fixed 15-IV/85-EV spread,
has no held items and never switches voluntarily. Its move selection prioritizes
immediate threats, knockouts, useful situational and status moves, and then the
strongest available damage.

Battle creation and commands require a login, and saved battles are scoped to
the account that created them. The server also owns daily encounter generation,
team membership, inventory, purchases, training, and monthly run resets. The
reviewed approvals CSV is validated against Showdown when the server starts.
