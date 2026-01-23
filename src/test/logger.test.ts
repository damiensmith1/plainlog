import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger, createTransport, LogEntry } from '../index';
import { InMemoryTransport } from '../transports/inMemoryTransport';
import { ConsoleTransport } from '../transports/console';
import { SilentConsoleTransport } from '../transports/silentConsoleTransport';
import { prettyFormatter } from '../formatter';

describe('Logger', () => {
  let logger: Logger;
  let memory: InMemoryTransport;

  beforeEach(() => {
    memory = new InMemoryTransport();
    logger = new Logger('info');
    logger.use(memory);
  });

  it('logs at correct level', async () => {
    await logger.debug('not visible');
    await logger.info('visible');
    await logger.error('visible too');
    const logs = memory.getLogs();
    expect(logs.length).toBe(2);
    expect(logs.map(l => l.level)).toEqual(['info', 'error']);
  });

  it('respects setLevel()', async () => {
    logger.setLevel('warn');
    await logger.info('skip');
    await logger.error('log');
    expect(memory.getLogs().length).toBe(1);
    expect(memory.getLogs()[0].level).toBe('error');
  });

  it('merges context and meta', async () => {
    const scoped = logger.withContext({ user: 'alice' });
    await scoped.info('login', { ip: '1.2.3.4' });
    const log = memory.getLogs()[0];
    expect(log.meta).toEqual({ user: 'alice', ip: '1.2.3.4' });
  });

  it('buffers logs and flushes', async () => {
    logger.enableBufferMode();
    await logger.warn('to be flushed');
    expect(memory.getLogs().length).toBe(0);
    await logger.flush();
    expect(memory.getLogs().length).toBe(1);
    expect(memory.getLogs()[0].message).toBe('to be flushed');
  });

  it('flush disables buffering', async () => {
    logger.enableBufferMode();
    await logger.info('buffered message');
    expect(memory.getLogs().length).toBe(0); // still buffering
    await logger.flush();
    expect(memory.getLogs().length).toBe(1); // flushed
    // after flush, new logs go directly to transports
    await logger.info('direct message');
    expect(memory.getLogs().length).toBe(2);
  });

  it('test mode captures logs', async () => {
    logger.enableTestMode();
    await logger.error('testing');
    const logs = logger.testLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].message).toBe('testing');
  });

  it('caps test buffer at MAX_BUFFER', async () => {
    logger.enableTestMode();
    for (let i = 0; i < 1100; i++) {
      await logger.info(`entry ${i}`);
    }
    expect(logger.testLogs().length).toBeLessThanOrEqual(1000);
  });

  it('caps buffer in buffer mode', async () => {
    logger.setLevel('debug');
    logger.enableBufferMode();
    for (let i = 0; i < 1100; i++) {
      await logger.debug(`b${i}`);
    }
    await logger.flush();
    // Only MAX_BUFFER entries should have been buffered and flushed
    expect(memory.getLogs().length).toBeLessThanOrEqual(1000);
  });

  it('safeLog handles transport errors', async () => {
    const badTransport = {
      log() {
        throw new Error('fail');
      }
    };
    logger.use(badTransport);
    await logger.warn('still safe');
    expect(memory.getLogs().length).toBe(1); // our memory transport still logs
  });

  it('setErrorHandler captures internal errors', async () => {
    const spy = vi.fn();
    logger.setErrorHandler(spy);
    logger.use({
      log() {
        throw new Error('oops');
      }
    });
    await logger.error('trigger error handler');
    expect(spy).toHaveBeenCalledWith(expect.any(Error));
  });

  it('withContext shares core (transports, error handler)', async () => {
    const child = logger.withContext({ a: 1 });
    await child.warn('test', { b: 2 });
    const log = memory.getLogs()[0];
    expect(log.meta).toEqual({ a: 1, b: 2 });
  });

  it('ConsoleTransport logs with correct formatter', async () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const testLogger = new Logger('info');
    testLogger.use(new ConsoleTransport(prettyFormatter));
    await testLogger.info('formatted log');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('formatted log'));
    spy.mockRestore();
  });

  it('SilentConsoleTransport logs nothing', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const silentLogger = new Logger();
    silentLogger.use(new SilentConsoleTransport());
    await silentLogger.info('should be silent');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('createTransport forwards formatted output', async () => {
    const spy = vi.fn();
    const customTransport = createTransport(spy, prettyFormatter);
    const logger = new Logger();
    logger.use(customTransport);
    await logger.info('created transport');
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('created transport'),
      expect.objectContaining({ level: 'info' })
    );
  });

  it('child logger shares buffer mode with parent', async () => {
    logger.enableBufferMode();
    const child = logger.withContext({ reqId: 'abc' });

    await child.info('buffered');
    expect(memory.getLogs().length).toBe(0);

    await logger.flush();
    expect(memory.getLogs().length).toBe(1);
    expect(memory.getLogs()[0].meta).toEqual({ reqId: 'abc' });
  });

  it('child logger shares test mode with parent', async () => {
    logger.enableTestMode();
    const child = logger.withContext({ a: 1 });

    await child.warn('captured');
    expect(logger.testLogs().length).toBe(1);
    expect(logger.testLogs()[0].meta).toEqual({ a: 1 });
  });
});
