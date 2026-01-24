import type { LogEntry, Transport } from '../../index';

export class ProcessStreamTransport implements Transport {
  constructor(private stream: NodeJS.WriteStream = process.stdout) {}

  log(entry: LogEntry) {
    this.stream.write(JSON.stringify(entry) + '\n');
  }
}