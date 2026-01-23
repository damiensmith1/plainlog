import type { LogEntry, Transport } from '../index';

export class JsonConsoleTransport implements Transport {
  log(entry: LogEntry) {
    console.log(JSON.stringify(entry));
  }
}