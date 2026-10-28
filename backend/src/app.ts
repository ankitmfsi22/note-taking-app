import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import type { Clock } from './common/clock.js';
import { createErrorHandler, notFoundHandler } from './common/errors/error-middleware.js';
import { createRequestLogger } from './common/http/request-logging.js';
import type { Env } from './config/env.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { healthRouter } from './modules/health/health.routes.js';

export interface AppDeps {
  prisma: PrismaClient;
  clock: Clock;
  env: Env;
  logger: Logger;
}

export const createApp = (deps: AppDeps): Express => {
  const app = express();
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(createRequestLogger(deps.logger));
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/v1', healthRouter);

  app.use(notFoundHandler);
  app.use(createErrorHandler(deps.logger));
  return app;
};
