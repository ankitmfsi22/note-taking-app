import { describe, expect, it, vi } from 'vitest';
import { buildEmailService } from './build-email-service.js';
import { ConsoleEmailService, type OtpSinkModule } from './email.service.js';

const clock = { now: () => new Date('2026-10-29T09:00:00.000Z') };

const spyLoader = () => {
  const sinkModule: OtpSinkModule = { createOtpTestSink: () => async () => {} };
  return vi.fn(() => Promise.resolve(sinkModule));
};

describe('buildEmailService', () => {
  it('S-AB1003-22: building the email service outside test never imports the sink', async () => {
    for (const NODE_ENV of ['development', 'production'] as const) {
      const loadSink = spyLoader();

      const service = await buildEmailService({
        env: { NODE_ENV },
        write: vi.fn(),
        clock,
        loadSink,
      });

      expect(loadSink).not.toHaveBeenCalled();
      expect(service).toBeInstanceOf(ConsoleEmailService);
      expect(service.sink).toBeUndefined();
    }

    const loadSink = spyLoader();
    const service = await buildEmailService({
      env: { NODE_ENV: 'test' },
      write: vi.fn(),
      clock,
      loadSink,
    });

    expect(loadSink).toHaveBeenCalledTimes(1);
    expect(service.sink).toBeDefined();
  });

  it('builds a service without a sink for test when no loader is given', async () => {
    const service = await buildEmailService({ env: { NODE_ENV: 'test' }, write: vi.fn(), clock });

    expect(service.sink).toBeUndefined();
  });
});
