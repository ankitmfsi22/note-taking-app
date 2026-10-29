import { systemClock } from '../common/clock.js';
import { createPrismaClient } from '../common/db/prisma.js';
import { createLogger } from '../common/logger.js';
import { loadEnv } from '../config/env.js';
import { createTrashPurgeRepository } from '../modules/notes/notes.repository.js';
import { createTrashPurgeJob } from './trash-purge.job.js';

// `pnpm --filter backend run job:purge`: one purge run for an external cron (SDS 8.5).
const main = async (): Promise<void> => {
  const env = loadEnv();
  const logger = createLogger(env);
  const prisma = createPrismaClient(env.DATABASE_URL);
  try {
    const job = createTrashPurgeJob({ repository: createTrashPurgeRepository(prisma) });
    logger.info({ purged: await job.run(systemClock.now()) }, 'trash purge finished');
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
