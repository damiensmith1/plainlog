export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

export interface Transport {
  log(entry: LogEntry): void | Promise<void>;
  flush?(): void | Promise<void>;
  close?(): void | Promise<void>;
}

export type LogFormatter = (entry: LogEntry) => string;

export interface LogErrorInfo {
  transport: Transport;
  entry: LogEntry;
}

export type ErrorHandler = (err: unknown, info: LogErrorInfo) => void;

export type MetaSanitizer = (meta: Record<string, unknown>) => Record<string, unknown>;

const DEFAULT_MAX_BUFFER = 1000;

class LoggerCore {
  public transports: Transport[] = [];
  public levelOrder: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  public currentLevel: LogLevel = 'debug';

  public testMode = false;
  public testLogBuffer: LogEntry[] = [];

  public isBuffering = false;
  public logBuffer: LogEntry[] = [];

  public logTimeoutMs = 1000;
  public maxBuffer = DEFAULT_MAX_BUFFER;
  public onErrorHook?: ErrorHandler;
  public sanitizer?: MetaSanitizer;

  constructor(level: LogLevel = 'debug', logTimeoutMs = 1000, maxBuffer = DEFAULT_MAX_BUFFER) {
    this.currentLevel = level;
    this.logTimeoutMs = logTimeoutMs;
    this.maxBuffer = maxBuffer;
  }

  setLevel(level: LogLevel) {
    this.currentLevel = level;
  }

  use(transport: Transport) {
    if (!this.transports.includes(transport)) {
      this.transports.push(transport);
    }
  }

  setErrorHandler(fn: ErrorHandler) {
    this.onErrorHook = fn;
  }

  setSanitizer(fn: MetaSanitizer) {
    this.sanitizer = fn;
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
    return this.testLogBuffer.slice();
  }

  enableBufferMode() {
    this.isBuffering = true;
  }

  disableBufferMode() {
    this.isBuffering = false;
  }

  private handleError(err: unknown, info: LogErrorInfo) {
    if (this.onErrorHook) this.onErrorHook(err, info);
    else console.error('[LOGGER ERROR]', err, info);
  }

  private async safeLog(t: Transport, entry: LogEntry) {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Log timeout')), this.logTimeoutMs)
    );

    try {
      await Promise.race([Promise.resolve(t.log(entry)), timeout]);
    } catch (err) {
      this.handleError(err, { transport: t, entry });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return (
      this.levelOrder.indexOf(level) >=
      this.levelOrder.indexOf(this.currentLevel)
    );
  }

  async emit(context: Record<string, unknown>, level: LogLevel, message: string, meta?: Record<string, unknown> | undefined) {
    if (!this.shouldLog(level)) return;

    let combinedMeta = { ...context, ...(meta ?? {}) };
    if (this.sanitizer && Object.keys(combinedMeta).length) {
      combinedMeta = this.sanitizer(combinedMeta);
    }
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      meta: Object.keys(combinedMeta).length ? combinedMeta : undefined,
    };

    if (this.testMode && this.testLogBuffer.length < this.maxBuffer) {
      this.testLogBuffer.push(entry);
    }

    if (this.isBuffering) {
      if (this.logBuffer.length < this.maxBuffer) this.logBuffer.push(entry);
      return;
    }

    await Promise.all(this.transports.map(t => this.safeLog(t, entry)));
  }

  async logRaw(entry: LogEntry) {
    if (!this.shouldLog(entry.level)) return;

    let sanitizedMeta = entry.meta;
    if (this.sanitizer && sanitizedMeta && Object.keys(sanitizedMeta).length) {
      sanitizedMeta = this.sanitizer(sanitizedMeta);
    }
    const normalized: LogEntry = {
      ...entry,
      meta: sanitizedMeta && Object.keys(sanitizedMeta).length ? sanitizedMeta : undefined,
    };

    if (this.testMode && this.testLogBuffer.length < this.maxBuffer) {
      this.testLogBuffer.push(normalized);
    }

    if (this.isBuffering) {
      if (this.logBuffer.length < this.maxBuffer) this.logBuffer.push(normalized);
      return;
    }

    await Promise.all(this.transports.map(t => this.safeLog(t, normalized)));
  }

  async flush() {
    const entries = this.logBuffer.slice();
    this.logBuffer.length = 0;
    this.isBuffering = false;

    for (const entry of entries) {
      await Promise.all(this.transports.map(t => this.safeLog(t, entry)));
    }

    await Promise.all(this.transports.map(t => t.flush?.()));
  }

  async close() {
    await this.flush();
    await Promise.all(this.transports.map(t => t.close?.()));
  }
}

export class Logger {
  private core: LoggerCore;
  private context: Record<string, unknown>;

  constructor(
    level: LogLevel = 'debug',
    context: Record<string, unknown> = {},
    logTimeoutMs = 1000,
    maxBuffer = 1000
  ) {
    this.core = new LoggerCore(level, logTimeoutMs, maxBuffer);
    this.context = context;
  }

  private static from(core: LoggerCore, context: Record<string, unknown>) {
    const logger = Object.create(Logger.prototype) as Logger;
    logger.core = core;
    logger.context = context;
    return logger;
  }

  withContext(ctx: Record<string, unknown>, mode: 'merge' | 'replace' = 'merge'): Logger {
    const newContext = mode === 'replace' ? ctx : { ...this.context, ...ctx };
    return Logger.from(this.core, newContext);
  }

  child(ctx: Record<string, unknown>): Logger {
    return this.withContext(ctx);
  }

  use(transport: Transport) {
    this.core.use(transport);
  }

  setLevel(level: LogLevel) {
    this.core.setLevel(level);
  }

  setErrorHandler(fn: ErrorHandler) {
    this.core.setErrorHandler(fn);
  }

  setSanitizer(fn: MetaSanitizer) {
    this.core.setSanitizer(fn);
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

  async close() {
    await this.core.close();
  }

  // Fire-and-forget (no await needed)
  debug(msg: string, meta?: Record<string, unknown>) {
    this.core.emit(this.context, 'debug', msg, meta);
  }
  info(msg: string, meta?: Record<string, unknown>) {
    this.core.emit(this.context, 'info', msg, meta);
  }
  warn(msg: string, meta?: Record<string, unknown>) {
    this.core.emit(this.context, 'warn', msg, meta);
  }
  error(msg: string, meta?: Record<string, unknown>) {
    this.core.emit(this.context, 'error', msg, meta);
  }
  log(entry: LogEntry) {
    this.core.logRaw(entry);
  }

  // Awaitable versions
  debugAsync(msg: string, meta?: Record<string, unknown>) {
    return this.core.emit(this.context, 'debug', msg, meta);
  }
  infoAsync(msg: string, meta?: Record<string, unknown>) {
    return this.core.emit(this.context, 'info', msg, meta);
  }
  warnAsync(msg: string, meta?: Record<string, unknown>) {
    return this.core.emit(this.context, 'warn', msg, meta);
  }
  errorAsync(msg: string, meta?: Record<string, unknown>) {
    return this.core.emit(this.context, 'error', msg, meta);
  }
  logAsync(entry: LogEntry) {
    return this.core.logRaw(entry);
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

export interface CreateLoggerOptions {
  level?: LogLevel;
  context?: Record<string, unknown>;
  transports?: Transport[];
  timeoutMs?: number;
  maxBuffer?: number;
}

const defaultConsoleTransport: Transport = {
  log(entry) {
    const method = entry.level === 'error' ? 'error'
      : entry.level === 'warn' ? 'warn'
      : entry.level === 'debug' ? 'debug'
      : 'info';
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
    if (entry.meta) console[method](prefix, entry.message, entry.meta);
    else console[method](prefix, entry.message);
  }
};

function getEnvLevel(): LogLevel | undefined {
  const p = (globalThis as any).process;
  const env = p?.env?.LOG_LEVEL;
  if (env && ['debug','info','warn','error'].includes(env)) return env;
}

export function createLogger(opts: CreateLoggerOptions = {}): Logger {
  const level = opts.level ?? getEnvLevel() ?? 'info';
  const logger = new Logger(level, opts.context ?? {}, opts.timeoutMs ?? 1000, opts.maxBuffer ?? 1000);

  const transports = opts.transports ?? [defaultConsoleTransport];
  for (const t of transports) {
    logger.use(t);
  }

  return logger;
}
