import type { LogEntry, Transport, LogFormatter } from '../index';
import { prettyFormatter } from '../formatter';

export class ConsoleTransport implements Transport {
  private formatter: LogFormatter;

  constructor(formatter: LogFormatter = prettyFormatter) {
    this.formatter = formatter;
  }

  log(entry: LogEntry) {
    const output = this.formatter(entry);

    switch (entry.level) {
      case 'error': console.error(output); break;
      case 'warn':  console.warn(output); break;
      case 'info':  console.info(output); break;
      default:      console.debug(output); break;
    }
  }
}
