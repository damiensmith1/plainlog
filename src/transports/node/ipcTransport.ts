import type { LogEntry, Transport } from '../../index';

export class IpcTransport implements Transport {
  constructor(private send = process.send) {}

  log(entry: LogEntry) {
    if (typeof this.send === 'function') {
      this.send({ type: 'log-entry', entry });
    }
  }
}
