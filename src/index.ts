export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

export interface Transport {
  log(entry: LogEntry): void | Promise<void>;
}

export type LogFormatter = (entry: LogEntry) => string;

const MAX_BUFFER = 1000;

export class Logger {
  private transports: Transport[] = [];
  private levelOrder: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  private currentLevel: LogLevel = 'debug';
  private context: Record<string, any> = {};
  private testMode = false;
  private testLogBuffer: LogEntry[] = [];
  private isBuffering = false;
  private logBuffer: LogEntry[] = [];
  private pendingLogs: Promise<void>[] = [];
  private logTimeoutMs = 1000;
  private onErrorHook?: (err: unknown) => void;

  constructor(
    level: LogLevel = 'debug',
    context: Record<string, any> = {},
    logTimeoutMs = 1000
  ) {
    this.currentLevel = level;
    this.context = context;
    this.logTimeoutMs = logTimeoutMs;
  }

  withContext(ctx: Record<string, any>): Logger {
    const combined = { ...this.context, ...ctx };
    const child = new Logger(this.currentLevel, combined, this.logTimeoutMs);
    child.transports = this.transports;
    child.pendingLogs = this.pendingLogs;
    child.onErrorHook = this.onErrorHook;
    return child;
  }

  use(transport: Transport) {
    if (!this.transports.includes(transport)) {
      this.transports.push(transport);
    }
  }

  setLevel(level: LogLevel) {
    this.currentLevel = level;
  }

  setErrorHandler(fn: (err: unknown) => void) {
    this.onErrorHook = fn;
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

  private enqueue(promise: Promise<void>) {
    this.pendingLogs.push(promise);
    promise.finally(() => {
      const idx = this.pendingLogs.indexOf(promise);
      if (idx !== -1) this.pendingLogs.splice(idx, 1);
    });
  }

  private async emitAsync(entry: LogEntry) {
    await Promise.all(this.transports.map(t => this.safeLog(t, entry)));
  }

  private emit(level: LogLevel, message: string, meta?: any) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      meta: { ...this.context, ...meta },
    };

    if (this.testMode && this.testLogBuffer.length < MAX_BUFFER) {
      this.testLogBuffer.push(entry);
    }

    if (this.isBuffering && this.logBuffer.length < MAX_BUFFER) {
      this.logBuffer.push(entry);
      return;
    }

    this.enqueue(this.emitAsync(entry));
  }

  debug(msg: string, meta?: any) {
    this.emit('debug', msg, meta);
  }
  info(msg: string, meta?: any) {
    this.emit('info', msg, meta);
  }
  warn(msg: string, meta?: any) {
    this.emit('warn', msg, meta);
  }
  error(msg: string, meta?: any) {
    this.emit('error', msg, meta);
  }

  log(entry: LogEntry) {
    if (!this.shouldLog(entry.level)) return;

    if (this.testMode && this.testLogBuffer.length < MAX_BUFFER) {
      this.testLogBuffer.push(entry);
    }

    if (this.isBuffering && this.logBuffer.length < MAX_BUFFER) {
      this.logBuffer.push(entry);
      return;
    }

    this.enqueue(this.emitAsync(entry));
  }

  async flush() {
    await Promise.all(this.pendingLogs);

    for (const entry of this.logBuffer) {
      await this.emitAsync(entry);
    }

    this.logBuffer = [];
    this.disableBufferMode();
  }

  enableTestMode() {
    this.testMode = true;
    this.testLogBuffer = [];
  }

  disableTestMode() {
    this.testMode = false;
    this.testLogBuffer = [];
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
