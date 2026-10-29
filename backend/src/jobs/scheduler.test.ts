import { pino } from 'pino';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startScheduler } from './scheduler.js';

const clock = { now: () => new Date('2026-10-29T09:00:00.000Z') };

describe('startScheduler', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs every job at startup and again each interval, and keeps going after a failure', async () => {
    vi.useFakeTimers();
    const ok = vi.fn().mockResolvedValue(3);
    const failing = vi.fn().mockRejectedValue(new Error('boom'));
    const logger = pino({ level: 'silent' });
    const errorSpy = vi.spyOn(logger, 'error');

    const scheduler = startScheduler({
      jobs: [
        { name: 'failing', run: failing },
        { name: 'ok', run: ok },
      ],
      clock,
      logger,
      intervalMs: 1000,
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(failing).toHaveBeenCalledTimes(1);
    expect(ok).toHaveBeenCalledWith(clock.now());
    expect(errorSpy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(ok).toHaveBeenCalledTimes(2);

    scheduler.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(ok).toHaveBeenCalledTimes(2);
  });
});
