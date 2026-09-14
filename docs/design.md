---
title: plainlog - Design
tags:
  - project
  - plainlog
status: active
---

# Design

See [[requirements]] for the full feature list this implements, and
[[background]] for why these tradeoffs were chosen.

## Package layout

- `src/index.ts` — `Logger` class, `createLogger()` helper, core types
- `src/formatter.ts` — pretty/plain formatting used by console-style
  transports
- `src/transports/*.ts` — browser-safe transports
- `src/transports/node/*.ts` — Node-only transports, published under a
  separate `plainlog/transports/node` export so they never end up in a
  browser bundle

Build via `tsup` to dual ESM/CJS + `.d.ts`, published as `plainlog` on npm.
Build config lives in `tsup.config.ts`, not CLI flags in `package.json`'s
`build` script — the entry list there must cover every path (including
individual transport files) that `package.json`'s `exports` map promises,
and `outExtension` must keep CJS output as `.cjs` / ESM as `.js` to match
those `exports` conditions exactly.

## Key decisions

> [!note] Explicit context over global/async-hook state
> Context is attached per logger instance (`withContext`/`child`) instead of
> tracked implicitly via globals or async hooks. Trades a little ergonomics
> (you pass the scoped logger around) for making data provenance obvious and
> eliminating cross-request leakage as a failure mode.

> [!note] Transport isolation
> Each transport call is timeout-protected and failures route through a
> single `setErrorHandler` instead of throwing. A bad transport (e.g. a
> flaky HTTP sink) degrades gracefully instead of taking down logging — or
> the app — with it.

> [!note] Fire-and-forget by default, awaitable when it matters
> Default logging calls don't block. `*Async` variants exist specifically
> for tests, shutdown sequences, and error paths where ordering/completion
> needs to be deterministic.

> [!note] `"type": "module"` + explicit tsup entries, not implicit build
> A CLI-only build script (`tsup src/index.ts ...`) silently drifted from
> the `exports` map over time — a build script change stopped generating
> individual transport files while `package.json` still promised them at
> `./transports/*`, and the CJS/ESM output extensions (`.js`/`.mjs`)
> never matched what `exports`/`main` declared (`.cjs`/`.js`), breaking
> `require('plainlog')` entirely (1.0.0). Fixed in 1.0.1 by moving the
> build to `tsup.config.ts` with an explicit entry list mirroring
> `exports`, an `outExtension` matching those conditions, and declaring
> `"type": "module"` so the `.js` ESM output isn't ambiguous to Node.

> [!note] Async transports must track their own in-flight writes for `flush()` to mean anything
> `Logger.flush()` only awaits transports that implement an optional
> `flush()`. `FileTransport`, `SmartFileTransport`, and `HttpTransport` did
> async work in `log()` (file appends, HTTP POSTs) but never implemented
> `flush()`, so `logger.flush()` silently returned before their writes
> landed — the opposite of the "awaitable when it matters" goal above.
> Fixed in 1.0.2: each now tracks its pending write(s) and implements
> `flush()` to await them. `FileTransport` chains writes into a single
> sequential promise (same file, so also fixes write-ordering under
> concurrent calls); `SmartFileTransport` and `HttpTransport` track a
> `Set` of in-flight promises instead, since their writes target
> independent files/requests and don't need to be serialized. Any new
> async transport must follow this pattern or `flush()`/`close()` will
> silently lie about completion for it.

## Open questions

- Is `colorette` (only runtime dependency) worth keeping vs. inlining a
  minimal color helper, given the "zero-dependency core" goal in the
  original [[Logger|idea note]]?
- Versioning/semver policy for transport interface changes as more
  transports get added
- Whether a docs site is worth it vs. README + this doc set being sufficient
