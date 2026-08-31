# plainlog

Lightweight, pluggable, testable logger for Node.js and the browser. Published on npm as `plainlog`.

Full context lives in `docs/` — read these before making non-trivial changes:

- `docs/background.md` — why this exists, what it's not trying to be
- `docs/requirements.md` — current feature set and non-goals
- `docs/design.md` — architecture decisions and open questions

These files are also mirrored into the Obsidian vault at
`Projects/plainlog/` (as symlinks) for viewing/editing outside the repo —
editing them there edits these same files.

## Conventions

- Build: `npm run build` (tsup, dual ESM/CJS + `.d.ts`)
- Test: `npm test` (vitest)
- Node-only transports must stay under `src/transports/node/` and the
  separate `transports/node` export — never import Node APIs from the
  browser-safe core or `src/transports/*.ts`.
