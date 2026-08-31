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

## Open questions

- Is `colorette` (only runtime dependency) worth keeping vs. inlining a
  minimal color helper, given the "zero-dependency core" goal in the
  original [[Logger|idea note]]?
- Versioning/semver policy for transport interface changes as more
  transports get added
- Whether a docs site is worth it vs. README + this doc set being sufficient
