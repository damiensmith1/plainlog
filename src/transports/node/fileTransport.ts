import { appendFile } from 'fs/promises';
import type { LogEntry, Transport } from '../../index';

export class FileTransport implements Transport {
  private pending: Promise<void> = Promise.resolve();

  constructor(private filepath: string) {}

  log(entry: LogEntry): Promise<void> {
    const { level, message, timestamp, meta } = entry;
    const line = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    const full = meta ? `${line} ${JSON.stringify(meta)}\n` : `${line}\n`;
    const write = this.pending.then(() => appendFile(this.filepath, full));
    this.pending = write.catch(() => {});
    return write;
  }

  flush(): Promise<void> {
    return this.pending;
  }
}
