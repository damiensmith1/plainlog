---
title: plainlog - Requirements
tags:
  - project
  - plainlog
status: active
---

# Requirements

Reflects the shipped v1.0.0 feature set (see [[background]] for the why).

## Core

- Log levels: `debug`, `info`, `warn`, `error`, configurable minimum level
- Structured log entries with ISO timestamps
- Fire-and-forget logging by default; awaitable variants (`infoAsync`, etc.)
  for deterministic ordering (tests, shutdown, error paths)

## Context

- `.withContext(context)` / `.child(context)` — explicit, scoped context
  inheritance, no global/async state
- Merge or replace semantics for context updates

## Transports

- Pluggable transport interface: `log(entry)`, optional `flush()` / `close()`
- Shipped: `ConsoleTransport`, `JsonConsoleTransport`, `SilentConsoleTransport`,
  `ErrorOnlyConsoleTransport`, `InMemoryTransport`, `HttpTransport`
- Node-only (separate entrypoint): `FileTransport`, `ProcessStreamTransport`,
  `IpcTransport`, `SmartFileTransport`
- Multiple transports attachable at once; timeout-protected; one failing
  transport must not affect others or crash the app
- `createTransport()` helper for ad-hoc transports

## Safety

- Centralized error handler (`setErrorHandler`) receives transport + entry
  context on failure — no thrown errors from logging itself
- Meta sanitization hook (`setSanitizer`) applied to all logging paths,
  including raw log injection, to prevent secret leakage

## Buffering

- `enableBufferMode()` + `flush()` for controlled/batched output
- Buffer size is capped to prevent memory leaks

## Testability

- `enableTestMode()` + `testLogs()` for in-memory capture and assertions
- Test logs isolated and capped

## Environment support

- Works in Node.js and the browser from the same core
- Node-only transports exported from a separate `plainlog/transports/node`
  entrypoint so browser bundles don't pull in Node APIs

## Non-goals

- Not competing with Winston on plugin ecosystem breadth
- Not competing with Pino on raw throughput
- No global singleton logger, no implicit/async-hook-based context
