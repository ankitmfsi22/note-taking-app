import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import type { Clock } from './common/clock.js';
import { createErrorHandler, notFoundHandler } from './common/errors/error-middleware.js';
import { createRequestLogger } from './common/http/request-logging.js';
import { createPasswordHasher, type PasswordHasher } from './common/security/hash.js';
import type { Env } from './config/env.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { createAuthController } from './modules/auth/auth.controller.js';
import { createAuthRepository } from './modules/auth/auth.repository.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { healthRouter } from './modules/health/health.routes.js';

export interface AppDeps {
  prisma: PrismaClient;
  clock: Clock;
  env: Env;
  logger: Logger;
  // Tests inject a spy; production builds one from the Argon2 settings in env.
  passwordHasher?: PasswordHasher;
}

export const createApp = (deps: AppDeps): Express => {
  const app = express();
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(createRequestLogger(deps.logger));
  app.use(express.json({ limit: '1mb' }));

  const authService = createAuthService({
    repository: createAuthRepository(deps.prisma),
    clock: deps.clock,
    passwordHasher:
      deps.passwordHasher ??
      createPasswordHasher({
        memoryCost: deps.env.ARGON2_MEMORY_KIB,
        timeCost: deps.env.ARGON2_TIME_COST,
      }),
    accessTokenSecret: deps.env.JWT_ACCESS_SECRET,
  });
  const authController = createAuthController({
    service: authService,
    secureCookie: deps.env.COOKIE_SECURE,
  });

  app.use('/api/v1', healthRouter);
  app.use(
    '/api/v1/auth',
    createAuthRouter({
      controller: authController,
      appOrigin: deps.env.APP_ORIGIN,
      secureCookie: deps.env.COOKIE_SECURE,
    }),
  );

  app.use(notFoundHandler);
  app.use(createErrorHandler(deps.logger));
  return app;
};
