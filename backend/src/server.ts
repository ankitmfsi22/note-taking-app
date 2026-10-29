import { createApp } from './app.js';
import { systemClock } from './common/clock.js';
import { createPrismaClient } from './common/db/prisma.js';
import { createLogger } from './common/logger.js';
import { loadEnv } from './config/env.js';
import { buildEmailService } from './modules/email/build-email-service.js';

const start = async (): Promise<void> => {
  const env = loadEnv();
  const logger = createLogger(env);
  const prisma = createPrismaClient(env.DATABASE_URL);
  // The test sink is imported only on this branch (ADR-0004); every other build leaves it unloaded.
  const loadSink = env.NODE_ENV === 'test' ? () => import('./testing/otp-test-sink.js') : undefined;
  const emailService = await buildEmailService({
    env,
    write: (line) => {
      process.stdout.write(`${line}\n`);
    },
    clock: systemClock,
    loadSink,
  });
  const app = createApp({ prisma, clock: systemClock, env, logger, emailService });

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

start().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
