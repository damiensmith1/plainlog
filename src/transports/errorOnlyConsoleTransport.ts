import type { LogEntry, Transport } from '../index';

export class ErrorOnlyConsoleTransport implements Transport {
  log(entry: LogEntry) {
    const { level, message, timestamp, meta } = entry;
    if (level !== 'warn' && level !== 'error') return;

    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    const metaPart = meta && Object.keys(meta).length > 0
      ? ` ${JSON.stringify(meta)}`
      : '';

    const output = `${prefix} ${message}${metaPart}`;
    console.error(output);
  }
}