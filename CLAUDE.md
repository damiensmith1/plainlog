# plainlog

Lightweight, pluggable, testable logger for Node.js and the browser. Published on npm as `plainlog`.

Full context lives in `docs/` — read these before making non-trivial changes:

- `docs/background.md` — why this exists, what it's not trying to be
- `docs/requirements.md` — current feature set and non-goals
- `docs/design.md` — architecture decisions and open questions

These files are also mirrored into the Obsidian vault at
`Projects/plainlog/` (as symlinks) for viewing/editing outside the repo —
editing them there edits these same files.

## Keeping docs in sync

Everything under docs/ is this project's source of truth, not a one-time
snapshot — including any file added there after initial setup, not just
background.md/requirements.md/design.md. In the SAME turn as a code
change (not a followup), update the relevant doc when you:
- resolve or add an open question in design.md
- make or change an architecture/approach decision
- add, change, or drop a requirement or non-goal
- learn something that changes the "why" in background.md
- create a new doc under docs/ for a topic that doesn't fit the above

Don't fabricate a decision that wasn't actually made. If it's unclear
whether something is doc-worthy, ask instead of guessing.

## Conventions

- Build: `npm run build` (tsup, dual ESM/CJS + `.d.ts`)
- Test: `npm test` (vitest)
- Node-only transports must stay under `src/transports/node/` and the
  separate `transports/node` export — never import Node APIs from the
  browser-safe core or `src/transports/*.ts`.
