# Logger Kit

A lightweight, modular, and testable logger built for modern Node.js apps, CLI tools, and libraries. Supports pluggable transports, context inheritance, buffering, test mode, and custom formatters.

Logger Kit is designed to be the simplest, most flexible logger for real-world workflows — including testing, scripting, and distributed systems — without the complexity or overhead of Winston or Pino.

---

## 🔍 Why Logger Kit?

| Feature                 | Winston | Pino  | Logger Kit |
|------------------------|---------|-------|------------|
| Transports             | ✅      | ✅    | ✅          |
| Custom formatters      | 🟡      | ✅    | ✅          |
| Context inheritance    | ❌      | ❌    | ✅          |
| Testable logs          | ❌      | ❌    | ✅          |
| Buffering & flushing   | ❌      | 🟡    | ✅          |
| Timeout-safe transports| ❌      | 🟡    | ✅          |
| Lightweight & modular  | ❌      | ✅    | ✅ (tiny)   |
| Easy to understand     | ❌      | 🟡    | ✅ (clean)  |

---

## 🚀 Features

- Log levels: `debug`, `info`, `warn`, `error`
- Pluggable transports (console, file, http, memory, custom)
- Context inheritance: `.withContext({ ... })`
- Test mode: capture logs for assertions
- Buffering: `enableBufferMode()` + `flush()`
- Log timeouts and safety guards
- Custom formatters per transport

---

## 📦 Installation

```bash
npm install logger-kit
```

---

## 🛠 Usage

```ts
import { Logger } from 'logger-kit';
import { ConsoleTransport } from 'logger-kit/transports';

const logger = new Logger('info');
logger.use(new ConsoleTransport());

logger.info('App started', { port: 3000 });

// Optional: await pending logs before exit
await logger.flush();
```

---

## 📚 API Overview

### Logger Methods

- `.info(message, meta?)`
- `.warn(message, meta?)`
- `.error(message, meta?)`
- `.debug(message, meta?)`
- `.log(entry)` — forward a pre-formed `LogEntry`
- `.setLevel(level)`
- `.use(transport)`
- `.withContext(context)`
- `.setErrorHandler(fn)` — handle transport errors
- `.enableTestMode()` / `.disableTestMode()` / `.testLogs()`
- `.enableBufferMode()` / `.disableBufferMode()` / `.flush()`

---

## 🎨 Custom Formatters

```ts
import type { LogFormatter } from 'logger-kit';

const myFormatter: LogFormatter = (entry) => {
  return `[${entry.level.toUpperCase()}] ${entry.message}`;
};

logger.use(new ConsoleTransport(myFormatter));
```

---

## 🔌 Custom Transports

```ts
import type { Transport, LogEntry } from 'logger-kit';

export class MyTransport implements Transport {
  async log(entry: LogEntry) {
    // Send to external system
    await fetch('https://my.logs.dev', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  }
}

logger.use(new MyTransport());
```

---

## 🧰 Utility: `createTransport()`

```ts
import { createTransport } from 'logger-kit';
import { prettyFormatter } from 'logger-kit/formatter';

const MyTransport = createTransport(console.log, prettyFormatter);
logger.use(MyTransport);
```

---

## 🧪 Test Mode

```ts
const logger = new Logger();
logger.enableTestMode();

logger.warn("Rate limit hit");

expect(logger.testLogs()).toContainEqual(
  expect.objectContaining({ level: 'warn', message: 'Rate limit hit' })
);
```

---

## 📁 Built-in Transports

- `ConsoleTransport`
- `JsonConsoleTransport`
- `FileTransport`
- `HttpTransport`
- `InMemoryTransport`
- `SilentConsoleTransport`
- `ErrorOnlyConsoleTransport`
- `ProcessStreamTransport`
- `IpcTransport`
- `SmartFileTransport`

---

---

## 🌐 Remote Logging with Relay

Logger Kit supports a simple pattern for **remote or cross-process logging** via HTTP.

### 🔁 Example: Log from any process to a central relay server

### 📡 1. Start a relay listener

```ts
// utils/relay-server.ts
import http from 'http';
import { Logger } from 'logger-kit';
import { ConsoleTransport } from 'logger-kit/transports';

const logger = new Logger('info');
logger.use(new ConsoleTransport());

http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/log') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', async () => {
      try {
        const entry = JSON.parse(body);
        logger.log(entry);
        res.writeHead(200).end('ok');
      } catch (err) {
        res.writeHead(400).end('bad log');
      }
    });
  } else {
    res.writeHead(404).end();
  }
}).listen(3000, () => {
  console.log('[Relay] Listening on port 3000');
});
```

---

### 🌍 2. Send logs remotely using HTTP

```ts
// utils/http-client.ts
const entry = {
  level: 'info',
  message: 'Started remote job',
  timestamp: new Date().toISOString(),
  meta: { job: 'cleanup', region: 'us-east-1' },
};

await fetch('http://localhost:3000/log', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(entry),
});
```

Or use the built-in `HttpTransport`:

```ts
import { Logger } from 'logger-kit';
import { HttpTransport } from 'logger-kit/transports';

const logger = new Logger();
logger.use(new HttpTransport('http://localhost:3000/log'));

logger.info('Sent to relay', { source: 'cli' });
```

---

This pattern allows multiple tools, scripts, containers, or worker threads to emit logs to a single location for central processing or output.


## 📜 License

MIT
