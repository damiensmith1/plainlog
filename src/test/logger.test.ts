import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  Logger,
  createLogger,
  createTransport,
  type LogEntry,
  type Transport,
} from "../index";
import { InMemoryTransport } from "../transports/inMemoryTransport";
import { ConsoleTransport } from "../transports/console";
import { SilentConsoleTransport } from "../transports/silentConsoleTransport";
import { prettyFormatter } from "../formatter";

describe("Logger", () => {
  let logger: Logger;
  let memory: InMemoryTransport;

  beforeEach(() => {
    memory = new InMemoryTransport();
    logger = new Logger("info");
    logger.use(memory);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    // cleanup any env monkeypatches
    delete (globalThis as any).process;
  });

  it("logs at correct level", async () => {
    await logger.debugAsync("not visible");
    await logger.infoAsync("visible");
    await logger.errorAsync("visible too");
    const logs = memory.getLogs();
    expect(logs.map((l) => l.level)).toEqual(["info", "error"]);
  });

  it("respects setLevel()", async () => {
    logger.setLevel("warn");
    await logger.infoAsync("skip");
    await logger.errorAsync("log");
    const logs = memory.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe("error");
  });

  it("merges context and meta", async () => {
    const scoped = logger.withContext({ user: "alice" });
    await scoped.infoAsync("login", { ip: "1.2.3.4" });
    const log = memory.getLogs()[0];
    expect(log.meta).toEqual({ user: "alice", ip: "1.2.3.4" });
  });

  it("withContext replace mode replaces context", async () => {
    const scoped = logger.withContext({ a: 1, b: 2 });
    const replaced = scoped.withContext({ b: 9 }, "replace");
    await replaced.infoAsync("test");
    const log = memory.getLogs()[0];
    expect(log.meta).toEqual({ b: 9 });
  });

  it("child() is an alias for withContext merge", async () => {
    const child = logger.child({ reqId: "abc" });
    await child.infoAsync("hi", { x: 1 });
    const log = memory.getLogs()[0];
    expect(log.meta).toEqual({ reqId: "abc", x: 1 });
  });

  it("omits meta when empty", async () => {
    await logger.infoAsync("no meta");
    const log = memory.getLogs()[0];
    expect(log.meta).toBeUndefined();
  });

  it("buffers logs and flushes", async () => {
    logger.enableBufferMode();
    await logger.warnAsync("to be flushed");
    expect(memory.getLogs().length).toBe(0);
    await logger.flush();
    expect(memory.getLogs().length).toBe(1);
    expect(memory.getLogs()[0].message).toBe("to be flushed");
  });

  it("flush disables buffering", async () => {
    logger.enableBufferMode();
    await logger.infoAsync("buffered");
    expect(memory.getLogs().length).toBe(0);
    await logger.flush();
    expect(memory.getLogs().length).toBe(1);

    // now direct
    await logger.infoAsync("direct");
    expect(memory.getLogs().length).toBe(2);
  });

  it("caps buffer in buffer mode by maxBuffer", async () => {
    const capped = new Logger("debug", {}, 1000, 10);
    capped.use(memory);

    capped.enableBufferMode();
    for (let i = 0; i < 50; i++) {
      await capped.debugAsync(`b${i}`);
    }
    await capped.flush();

    expect(memory.getLogs().length).toBeLessThanOrEqual(10);
  });

  it("test mode captures logs (and returns a copy)", async () => {
    logger.enableTestMode();
    await logger.errorAsync("testing");

    const logs1 = logger.testLogs();
    expect(logs1.length).toBe(1);

    // mutate returned array shouldn't affect internal
    logs1.length = 0;
    const logs2 = logger.testLogs();
    expect(logs2.length).toBe(1);
  });

  it("caps test buffer at maxBuffer", async () => {
    const capped = new Logger("info", {}, 1000, 10);
    capped.use(memory);
    capped.enableTestMode();

    for (let i = 0; i < 50; i++) {
      await capped.infoAsync(`t${i}`);
    }
    expect(capped.testLogs().length).toBeLessThanOrEqual(10);
  });

  it("safeLog handles transport errors and still logs to other transports", async () => {
    // silence stderr in this test
    logger.setErrorHandler(() => {});

    const badTransport: Transport = {
      log() {
        throw new Error("fail");
      },
    };

    logger.use(badTransport);
    await logger.warnAsync("still safe");

    expect(memory.getLogs().length).toBe(1);
    expect(memory.getLogs()[0].message).toBe("still safe");
  });

  it("setErrorHandler receives (err, {transport, entry})", async () => {
    const spy = vi.fn();
    logger.setErrorHandler(spy);

    const badTransport: Transport = {
      log() {
        throw new Error("oops");
      },
    };
    logger.use(badTransport);

    await logger.errorAsync("trigger");
    expect(spy).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        transport: badTransport,
        entry: expect.objectContaining({ message: "trigger", level: "error" }),
      })
    );
  });

  it("transport timeout triggers error handler", async () => {
    vi.useFakeTimers();
    const spy = vi.fn();

    const timeoutLogger = new Logger("info", {}, 10);
    timeoutLogger.setErrorHandler(spy);

    const hangingTransport: Transport = {
      log() {
        return new Promise(() => {
          // never resolves
        });
      },
    };
    timeoutLogger.use(hangingTransport);

    const p = timeoutLogger.infoAsync("hang");
    await vi.advanceTimersByTimeAsync(20);
    await p;

    expect(spy).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        transport: hangingTransport,
        entry: expect.objectContaining({ message: "hang" }),
      })
    );
  });

  it("sanitizer runs on emit() meta (and can remove secrets)", async () => {
    logger.setSanitizer((meta) => {
      const { token, ...rest } = meta as any;
      return rest;
    });

    const scoped = logger.withContext({ token: "SECRET", user: "a" });
    await scoped.infoAsync("hello", { ip: "1.2.3.4", token: "NOPE" });

    const log = memory.getLogs()[0];
    expect(log.meta).toEqual({ user: "a", ip: "1.2.3.4" });
  });

  it("sanitizer runs on logRaw() meta too", async () => {
    logger.setSanitizer((meta) => {
      const copy = { ...meta };
      delete (copy as any).password;
      return copy;
    });

    const entry: LogEntry = {
      level: "info",
      message: "raw",
      timestamp: new Date().toISOString(),
      meta: { password: "123", ok: true },
    };

    await logger.logAsync(entry);
    const log = memory.getLogs()[0];
    expect(log.meta).toEqual({ ok: true });
  });

  it("flush() calls transport.flush() hooks", async () => {
    const flushSpy = vi.fn();
    const t: Transport = {
      log() {},
      flush: flushSpy,
    };
    logger.use(t);

    logger.enableBufferMode();
    await logger.infoAsync("buffered");
    await logger.flush();

    expect(flushSpy).toHaveBeenCalledTimes(1);
  });

  it("close() calls flush() and then transport.close()", async () => {
    const flushSpy = vi.fn();
    const closeSpy = vi.fn();

    const t: Transport = {
      log: vi.fn(),
      flush: flushSpy,
      close: closeSpy,
    };

    logger.use(t);

    logger.enableBufferMode();
    await logger.infoAsync("buffered");
    await logger.close();

    expect(flushSpy).toHaveBeenCalledTimes(1);
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it("ConsoleTransport logs with formatter", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const testLogger = new Logger("info");
    testLogger.use(new ConsoleTransport(prettyFormatter));

    await testLogger.infoAsync("formatted log");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("formatted log"));
  });

  it("SilentConsoleTransport logs nothing", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const silentLogger = new Logger("debug");
    silentLogger.use(new SilentConsoleTransport());

    await silentLogger.infoAsync("should be silent");
    expect(spy).not.toHaveBeenCalled();
  });

  it("createTransport forwards formatted output", async () => {
    const spy = vi.fn();
    const customTransport = createTransport(spy, prettyFormatter);
    const l = new Logger("debug");
    l.use(customTransport);

    await l.infoAsync("created transport");
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("created transport"),
      expect.objectContaining({ level: "info" })
    );
  });

  it("createLogger uses provided transports (no default console spam)", async () => {
    const spy = vi.fn();
    const t: Transport = { log: spy };
    const l = createLogger({ level: "info", transports: [t] });
    await l.infoAsync("hi");
    expect(spy).toHaveBeenCalled();
  });

  it("createLogger reads LOG_LEVEL from env if present", async () => {
    (globalThis as any).process = { env: { LOG_LEVEL: "error" } };

    const l = createLogger({ transports: [memory] });
    await l.infoAsync("skip");
    await l.errorAsync("log");

    const logs = memory.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe("error");
  });
});
