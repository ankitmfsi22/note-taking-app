import { createApp } from './app.js';
import { systemClock } from './common/clock.js';
import { createPrismaClient } from './common/db/prisma.js';
import { createLogger } from './common/logger.js';
import { loadEnv } from './config/env.js';

const start = (): void => {
  const env = loadEnv();
  const logger = createLogger(env);
  const prisma = createPrismaClient(env.DATABASE_URL);
  const app = createApp({ prisma, clock: systemClock, env, logger });

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'server listening');
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'shutting down');
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
};

try {
  start();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
