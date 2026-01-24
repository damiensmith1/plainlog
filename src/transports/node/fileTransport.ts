import { appendFile } from 'fs/promises';
import type { LogEntry, Transport } from '../../index';

export class FileTransport implements Transport {
  constructor(private filepath: string) {}

  async log(entry: LogEntry) {
    const { level, message, timestamp, meta } = entry;
    const line = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    const full = meta ? `${line} ${JSON.stringify(meta)}\n` : `${line}\n`;
    await appendFile(this.filepath, full);
  }
}