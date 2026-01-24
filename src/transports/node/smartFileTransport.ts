import { appendFile } from 'fs/promises';
import type { LogEntry, Transport } from '../../index';

export class SmartFileTransport implements Transport {
  constructor(
    private route: (entry: LogEntry) => string,
    private baseDir: string = './logs'
  ) {}

  async log(entry: LogEntry) {
    const target = this.route(entry);
    const path = `${this.baseDir}/${target}`;
    const line = JSON.stringify(entry) + '\n';
    await appendFile(path, line);
  }
}
