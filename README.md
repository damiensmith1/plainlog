# plainlog

A lightweight, pluggable, and testable logger for modern JavaScript and TypeScript apps — **designed for real codebases**, not just demos.

plainlog works in **Node.js and the browser**, supports **context inheritance**, **buffering**, **transport safety**, and is intentionally small enough that you can actually understand it.

📦 npm: https://www.npmjs.com/package/plainlog

---

## Why plainlog Exists

Most popular loggers fall into one of two camps:

### ❌ Heavy & Abstract

* Large APIs with many concepts
* Hard to reason about in tests
* Context propagation is awkward or missing
* Easy to misuse, hard to debug

### ❌ Ultra-fast but Rigid

* Optimized for throughput over ergonomics
* Minimal context support
* Not great for testing or small tools
* Often feels “too low-level” for application logic

### plainlog’s Philosophy

plainlog is built around a simple idea:

> **Logging should be easy to reason about, easy to test, and never break your app.**

That means:

* No global singletons
* No magic context
* No hidden async behavior
* No logging failures crashing your process
* No framework lock-in

plainlog is especially well-suited for:

* application code
* CLIs and scripts
* browser apps
* test environments
* distributed systems glue code

---

## Features

### Core

* Log levels: `debug`, `info`, `warn`, `error`
* Structured log entries with ISO timestamps
* Context inheritance (`withContext`, `child`)
* Fire-and-forget logging **or** awaitable logging

### Safety & Reliability

* Transport isolation (one bad transport won’t break others)
* Timeout-protected transports
* Centralized error handler with context
* Optional buffering with flush semantics
* Configurable buffer limits

### Testability

* Test mode to capture logs in memory
* Deterministic async APIs for assertions
* No globals or hidden state

### Extensibility

* Pluggable transports
* Optional lifecycle hooks (`flush`, `close`)
* Meta sanitization hook to prevent leaks
* Simple transport factory helper

### Environment Support

* Works in **Node.js and the browser**
* Browser-safe core + transports
* Node-only transports exported separately

---

## Installation

```bash
npm install logger-kit
```

---

## Basic Usage

```ts
import { Logger } from "logger-kit";

const logger = new Logger("info");

logger.info("App started");
logger.warn("Low disk space", { freeMB: 120 });
logger.error("Something broke", { code: "E_FAIL" });
```

Logs are structured objects internally and only formatted by transports.

---

## Transports

### Console (browser & Node)

```ts
import { ConsoleTransport } from "logger-kit/transports";

logger.use(new ConsoleTransport());
```

### JSON Console

```ts
import { JsonConsoleTransport } from "logger-kit/transports";

logger.use(new JsonConsoleTransport());
```

### Silent (useful for tests)

```ts
import { SilentConsoleTransport } from "logger-kit/transports";

logger.use(new SilentConsoleTransport());
```

---

## Node-Only Transports

```ts
import { FileTransport } from "logger-kit/transports/node";

logger.use(new FileTransport("./app.log"));
```

Other node transports:

* `ProcessStreamTransport`
* `IpcTransport`
* `SmartFileTransport`

---

## Context Inheritance

plainlog supports **explicit context propagation**.

```ts
const base = new Logger("info", { service: "api" });

const requestLogger = base.withContext({ reqId: "abc123" });

requestLogger.info("Handling request");
```

### Replace vs Merge Context

```ts
logger.withContext({ a: 1, b: 2 });
logger.withContext({ b: 9 }, "replace");
```

### `child()` Alias

```ts
const child = logger.child({ userId: "u1" });
```

---

## Fire-and-Forget vs Awaitable Logging

By default, logging is **fire-and-forget**:

```ts
logger.info("Hello"); // no await needed
```

If you need determinism (tests, shutdown, error handling):

```ts
await logger.infoAsync("Hello");
```

Available async variants:

* `debugAsync`
* `infoAsync`
* `warnAsync`
* `errorAsync`
* `logAsync`

---

## Buffering & Flushing

Useful for startup, batch jobs, or controlled output.

```ts
logger.enableBufferMode();

logger.info("Buffered");
logger.info("Still buffered");

await logger.flush(); // writes all buffered logs
```

Buffers are capped to prevent memory leaks.

---

## Test Mode

Capture logs without a transport:

```ts
logger.enableTestMode();

await logger.warnAsync("Rate limited");

expect(logger.testLogs()).toEqual([
  expect.objectContaining({ level: "warn" })
]);
```

Test logs are isolated and capped.

---

## Error Handling

Transport failures **never throw**.

Instead, you can register a handler:

```ts
logger.setErrorHandler((err, { transport, entry }) => {
  // report to Sentry, metrics, etc.
});
```

Timeouts are treated as errors too.

---

## Meta Sanitization

Prevent secrets from leaking into logs:

```ts
logger.setSanitizer((meta) => {
  const { token, password, ...safe } = meta;
  return safe;
});
```

Runs for:

* normal logging
* raw log injection
* all transports

---

## Custom Transports

### Implement a Transport

```ts
import type { Transport, LogEntry } from "logger-kit";

class MyTransport implements Transport {
  async log(entry: LogEntry) {
    await sendSomewhere(entry);
  }

  async flush() {}
  async close() {}
}
```

### Or use `createTransport()`

```ts
import { createTransport } from "logger-kit";
import { prettyFormatter } from "logger-kit/formatter";

const transport = createTransport(console.log, prettyFormatter);
logger.use(transport);
```

---

## `createLogger()` Helper

For quick setup with sane defaults:

```ts
import { createLogger } from "logger-kit";

const logger = createLogger({
  level: "info",
});
```

Supports:

* env-based `LOG_LEVEL`
* default console transport
* custom transports
* buffer limits

---

## API Summary

### Logger

* `debug | info | warn | error`
* `debugAsync | infoAsync | warnAsync | errorAsync`
* `withContext`, `child`
* `enableBufferMode`, `flush`, `close`
* `enableTestMode`, `testLogs`
* `setLevel`, `setErrorHandler`, `setSanitizer`
* `log`, `logAsync`

### Transport

* `log(entry)`
* `flush?()`
* `close?()`

---

## License

MIT

