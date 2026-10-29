import { pino } from 'pino';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startBackgroundJobs } from './background-jobs.js';

const HOUR_MS = 60 * 60 * 1000;
const clock = { now: () => new Date('2026-10-29T09:00:00.000Z') };
const logger = pino({ level: 'silent' });

describe('startBackgroundJobs', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('S-AB1004-07: the purge job runs at startup and hourly, and JOBS_ENABLED=false turns it off', async () => {
    vi.useFakeTimers();
    const enabledPurge = vi.fn().mockResolvedValue(0);
    const disabledPurge = vi.fn().mockResolvedValue(0);

    const enabled = startBackgroundJobs({
      env: { JOBS_ENABLED: true },
      trashPurge: enabledPurge,
      clock,
      logger,
    });
    const disabled = startBackgroundJobs({
      env: { JOBS_ENABLED: false },
      trashPurge: disabledPurge,
      clock,
      logger,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(enabledPurge).toHaveBeenCalledTimes(1);
    expect(enabledPurge).toHaveBeenCalledWith(clock.now());
    await vi.advanceTimersByTimeAsync(HOUR_MS);
    expect(enabledPurge).toHaveBeenCalledTimes(2);

    expect(disabled).toBeUndefined();
    expect(disabledPurge).not.toHaveBeenCalled();
    enabled?.stop();
  });
});
