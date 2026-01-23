import type { LogEntry, Transport } from '../index';

export class HttpTransport implements Transport {
  constructor(
    private endpoint: string,
    private headers: Record<string, string> = {}
  ) {}

  async log(entry: LogEntry) {
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
  }
}
