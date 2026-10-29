import type { Logger } from 'pino';
import type { Clock } from '../common/clock.js';
import type { Env } from '../config/env.js';
import { startScheduler, type ScheduledJob } from './scheduler.js';

// The one place JOBS_ENABLED is read, so S-AB1004-07 can prove the switch without starting a
// server. undefined means nothing was scheduled.
export const startBackgroundJobs = ({
  env,
  trashPurge,
  clock,
  logger,
}: {
  env: Pick<Env, 'JOBS_ENABLED'>;
  trashPurge: ScheduledJob['run'];
  clock: Clock;
  logger: Logger;
}): { stop(): void } | undefined =>
  env.JOBS_ENABLED
    ? startScheduler({ jobs: [{ name: 'trash-purge', run: trashPurge }], clock, logger })
    : undefined;
