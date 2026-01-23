export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  meta?: Record<string, unknown>;
}

export interface Transport {
  log(entry: LogEntry): void | Promise<void>;
}

export type LogFormatter = (entry: LogEntry) => string;

const MAX_BUFFER = 1000;

class LoggerCore {
  public transports: Transport[] = [];
  public levelOrder: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  public currentLevel: LogLevel = 'debug';

  public testMode = false;
  public testLogBuffer: LogEntry[] = [];

  public isBuffering = false;
  public logBuffer: LogEntry[] = [];

  public logTimeoutMs = 1000;
  public onErrorHook?: (err: unknown) => void;

  constructor(level: LogLevel = 'debug', logTimeoutMs = 1000) {
    this.currentLevel = level;
    this.logTimeoutMs = logTimeoutMs;
  }

  setLevel(level: LogLevel) {
    this.currentLevel = level;
  }

  use(transport: Transport) {
    if (!this.transports.includes(transport)) {
      this.transports.push(transport);
    }
  }

  setErrorHandler(fn: (err: unknown) => void) {
    this.onErrorHook = fn;
  }

  enableTestMode() {
    this.testMode = true;
    this.testLogBuffer.length = 0;
  }

  disableTestMode() {
    this.testMode = false;
    this.testLogBuffer.length = 0;
  }

  testLogs(): LogEntry[] {
    return this.testLogBuffer;
  }

  enableBufferMode() {
    this.isBuffering = true;
  }

  disableBufferMode() {
    this.isBuffering = false;
  }

  private handleError(err: unknown) {
    if (this.onErrorHook) this.onErrorHook(err);
    else console.error('[LOGGER ERROR]', err);
  }

  private async safeLog(t: Transport, entry: LogEntry) {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Log timeout')), this.logTimeoutMs)
    );

    try {
      await Promise.race([Promise.resolve(t.log(entry)), timeout]);
    } catch (err) {
      this.handleError(err);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return (
      this.levelOrder.indexOf(level) >=
      this.levelOrder.indexOf(this.currentLevel)
    );
  }

  async emit(context: Record<string, unknown>, level: LogLevel, message: string, meta?: Record<string, unknown>) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      meta: { ...context, ...(meta ?? {}) },
    };

    if (this.testMode && this.testLogBuffer.length < MAX_BUFFER) {
      this.testLogBuffer.push(entry);
    }

    if (this.isBuffering) {
      if (this.logBuffer.length < MAX_BUFFER) this.logBuffer.push(entry);
      return;
    }

    await Promise.all(this.transports.map(t => this.safeLog(t, entry)));
  }

  async logRaw(entry: LogEntry) {
    if (!this.shouldLog(entry.level)) return;

    if (this.testMode && this.testLogBuffer.length < MAX_BUFFER) {
      this.testLogBuffer.push(entry);
    }

    if (this.isBuffering) {
      if (this.logBuffer.length < MAX_BUFFER) this.logBuffer.push(entry);
      return;
    }

    await Promise.all(this.transports.map(t => this.safeLog(t, entry)));
  }

  async flush() {
    const entries = this.logBuffer.slice();
    this.logBuffer.length = 0;
    this.isBuffering = false;

    for (const entry of entries) {
      await Promise.all(this.transports.map(t => this.safeLog(t, entry)));
    }
  }
}

export class Logger {
  private core: LoggerCore;
  private context: Record<string, unknown>;

  constructor(
    level: LogLevel = 'debug',
    context: Record<string, unknown> = {},
    logTimeoutMs = 1000
  ) {
    this.core = new LoggerCore(level, logTimeoutMs);
    this.context = context;
  }

  private static from(core: LoggerCore, context: Record<string, unknown>) {
    const logger = Object.create(Logger.prototype) as Logger;
    logger.core = core;
    logger.context = context;
    return logger;
  }

  withContext(ctx: Record<string, unknown>): Logger {
    return Logger.from(this.core, { ...this.context, ...ctx });
  }

  use(transport: Transport) {
    this.core.use(transport);
  }

  setLevel(level: LogLevel) {
    this.core.setLevel(level);
  }

  setErrorHandler(fn: (err: unknown) => void) {
    this.core.setErrorHandler(fn);
  }

  enableTestMode() {
    this.core.enableTestMode();
  }
  disableTestMode() {
    this.core.disableTestMode();
  }
  testLogs(): LogEntry[] {
    return this.core.testLogs();
  }

  enableBufferMode() {
    this.core.enableBufferMode();
  }
  disableBufferMode() {
    this.core.disableBufferMode();
  }
  async flush() {
    await this.core.flush();
  }

  async debug(msg: string, meta?: Record<string, unknown>) {
    await this.core.emit(this.context, 'debug', msg, meta);
  }
  async info(msg: string, meta?: Record<string, unknown>) {
    await this.core.emit(this.context, 'info', msg, meta);
  }
  async warn(msg: string, meta?: Record<string, unknown>) {
    await this.core.emit(this.context, 'warn', msg, meta);
  }
  async error(msg: string, meta?: Record<string, unknown>) {
    await this.core.emit(this.context, 'error', msg, meta);
  }

  async log(entry: LogEntry) {
    await this.core.logRaw(entry);
  }
}

export function createTransport(
  writeFn: (formatted: string, entry: LogEntry) => void | Promise<void>,
  formatter: LogFormatter
): Transport {
  return {
    log(entry) {
      const output = formatter(entry);
      return writeFn(output, entry);
    }
  };
}
