# Backend

The local backend serves the frontend and owns Pokémon Showdown battle sessions.

From the repository root:

```bash
nvm use
npm install
npm run dev
```

Open <http://127.0.0.1:3000>. Accounts, login sessions, and battle records are
written beneath `backend/data/` and are intentionally excluded from Git. Set
`PORT`, `HOST`, or `NUZZLE_DATA_DIR` to override the local defaults.

Register or log in from the account button in the top-right corner. Sessions
use a 30-day HttpOnly cookie, so a browser stays signed in without storing an
authentication token in frontend JavaScript. Passwords are hashed with scrypt.
This JSON-backed account store is suitable for local development and can be
replaced by a hosted database before deployment; it is not the final production
account system and currently has no email recovery flow.

Users may optionally upload a profile picture. The browser center-crops and
resizes it to a 256-pixel WebP before upload; local avatar files live in
`backend/data/avatars/`. Uploaded images are private to the signed-in account
endpoint and should move to managed object storage for production deployment.

The current battle slice uses Generation 9 Custom Game mechanics. Both teams
are level 100 with 15 IVs and 85 EVs in each stat. Brock has no held items,
never switches voluntarily, and chooses a random legal move.

Battle creation and commands require a login, and saved battles are scoped to
the account that created them. The roster endpoint remains public because the
current roster is still shared prototype content.
