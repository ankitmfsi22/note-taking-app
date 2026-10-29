import type { Logger } from 'pino';
import type { Clock } from '../common/clock.js';

const HOUR_MS = 60 * 60 * 1000;

export interface ScheduledJob {
  name: string;
  run(now: Date): Promise<unknown>;
}

// SDS 8.5: every job runs once at startup and then hourly. The timer is unref'd so it never keeps
// the process alive, and a failing run is logged without stopping later runs.
export const startScheduler = ({
  jobs,
  clock,
  logger,
  intervalMs = HOUR_MS,
}: {
  jobs: ScheduledJob[];
  clock: Clock;
  logger: Logger;
  intervalMs?: number;
}): { stop(): void } => {
  const runAll = async (): Promise<void> => {
    for (const job of jobs) {
      try {
        const result = await job.run(clock.now());
        logger.info({ job: job.name, result }, 'scheduled job finished');
      } catch (error) {
        logger.error({ job: job.name, err: error }, 'scheduled job failed');
      }
    }
  };

  void runAll();
  const timer = setInterval(() => void runAll(), intervalMs);
  timer.unref();
  return { stop: () => clearInterval(timer) };
};
