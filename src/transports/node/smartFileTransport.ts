import { appendFile } from 'fs/promises';
import type { LogEntry, Transport } from '../../index';

export class SmartFileTransport implements Transport {
  private pending = new Set<Promise<void>>();

  constructor(
    private route: (entry: LogEntry) => string,
    private baseDir: string = './logs'
  ) {}

  log(entry: LogEntry): Promise<void> {
    const target = this.route(entry);
    const path = `${this.baseDir}/${target}`;
    const line = JSON.stringify(entry) + '\n';
    const write: Promise<void> = appendFile(path, line);
    this.pending.add(write);
    write.catch(() => {}).finally(() => this.pending.delete(write));
    return write;
  }

  flush(): Promise<void> {
    return Promise.all(this.pending).then(() => {});
  }
}
