import type { LogEntry, Transport } from '../index';

export class HttpTransport implements Transport {
  private pending = new Set<Promise<void>>();

  constructor(
    private endpoint: string,
    private headers: Record<string, string> = {}
  ) {}

  log(entry: LogEntry): Promise<void> {
    const send = async () => {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers,
        },
        body: JSON.stringify(entry),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
    };

    const write = send();
    this.pending.add(write);
    write.catch(() => {}).finally(() => this.pending.delete(write));
    return write;
  }

  flush(): Promise<void> {
    return Promise.all(this.pending).then(() => {});
  }
}
