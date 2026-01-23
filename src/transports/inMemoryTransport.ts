import type { LogEntry, Transport } from '../index';

export class InMemoryTransport implements Transport {
  logs: LogEntry[] = [];

  log(entry: LogEntry) {
    this.logs.push(entry);
  }

  clear() {
    this.logs = [];
  }

  getLogs(): LogEntry[] {
    return this.logs;
  }
}
