import { green, yellow, red, gray } from 'colorette';
import type { LogFormatter } from './index';

export const prettyFormatter: LogFormatter = (entry) => {
  const { level, message, timestamp, meta } = entry;

  const levelColor = {
    debug: gray,
    info: green,
    warn: yellow,
    error: red,
  }[level] || ((t: string) => t);

  const prefix = `[${timestamp}] [${levelColor(level.toUpperCase())}]`;
  const metaPart = meta && Object.keys(meta).length > 0
    ? ` ${JSON.stringify(meta)}`
    : '';

  return `${prefix} ${message}${metaPart}`;
};
