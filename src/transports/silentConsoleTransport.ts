import type { LogEntry, Transport } from '../index';

export class SilentConsoleTransport implements Transport {
  log(_: LogEntry) {
    // no-op
  }
}