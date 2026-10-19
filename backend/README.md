# Backend

The local backend serves the frontend and owns Pokémon Showdown battle sessions.

From the repository root:

```bash
nvm use
npm install
npm run dev
```

Open <http://127.0.0.1:3000>. Battle records are written beneath
`backend/data/` and are intentionally excluded from Git. Set `PORT`, `HOST`,
or `NUZZLE_DATA_DIR` to override the local defaults.

The current battle slice uses Generation 9 Custom Game mechanics. Both teams
are level 100 with 15 IVs and 85 EVs in each stat. Brock has no held items,
never switches voluntarily, and chooses a random legal move.
