import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import type { Clock } from './common/clock.js';
import { createErrorHandler, notFoundHandler } from './common/errors/error-middleware.js';
import { createRequestLogger } from './common/http/request-logging.js';
import { createRequireAuth } from './common/http/require-auth.js';
import {
  createOtpHasher,
  createPasswordHasher,
  type OtpHasher,
  type PasswordHasher,
} from './common/security/hash.js';
import type { Env } from './config/env.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { createAuthController } from './modules/auth/auth.controller.js';
import { createAuthRepository } from './modules/auth/auth.repository.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { createPasswordResetController } from './modules/auth/password-reset.controller.js';
import { createPasswordResetService } from './modules/auth/password-reset.service.js';
import type { EmailService } from './modules/email/email.service.js';
import { healthRouter } from './modules/health/health.routes.js';
import { createNotesController } from './modules/notes/notes.controller.js';
import { createNotesRepository } from './modules/notes/notes.repository.js';
import { createNotesRouter } from './modules/notes/notes.routes.js';
import { createNotesService } from './modules/notes/notes.service.js';
import { createSearchController } from './modules/search/search.controller.js';
import { createSearchRepository } from './modules/search/search.repository.js';
import { createSearchRouter } from './modules/search/search.routes.js';
import { createSearchService } from './modules/search/search.service.js';
import { createSharesController } from './modules/shares/shares.controller.js';
import { createSharesRepository } from './modules/shares/shares.repository.js';
import { createSharesRouter } from './modules/shares/shares.routes.js';
import { createSharesService } from './modules/shares/shares.service.js';
import { createTagsController } from './modules/tags/tags.controller.js';
import { createTagsRepository } from './modules/tags/tags.repository.js';
import { createNoteTagsRouter, createTagsRouter } from './modules/tags/tags.routes.js';
import { createTagsService } from './modules/tags/tags.service.js';
import { createVersionsController } from './modules/versions/versions.controller.js';
import { createVersionsRepository } from './modules/versions/versions.repository.js';
import { createVersionsRouter } from './modules/versions/versions.routes.js';
import { createVersionsService } from './modules/versions/versions.service.js';

export interface AppDeps {
  prisma: PrismaClient;
  clock: Clock;
  env: Env;
  logger: Logger;
  // Tests inject a spy; production builds one from the Argon2 settings in env.
  passwordHasher?: PasswordHasher;
  emailService: EmailService;
  // Tests inject a spy; production keys one with OTP_HMAC_SECRET.
  otpHasher?: OtpHasher;
}

export const createApp = (deps: AppDeps): Express => {
  const app = express();
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(createRequestLogger(deps.logger));
  app.use(express.json({ limit: '1mb' }));

  const repository = createAuthRepository(deps.prisma);
  const passwordHasher =
    deps.passwordHasher ??
    createPasswordHasher({
      memoryCost: deps.env.ARGON2_MEMORY_KIB,
      timeCost: deps.env.ARGON2_TIME_COST,
    });
  const authService = createAuthService({
    repository,
    clock: deps.clock,
    passwordHasher,
    accessTokenSecret: deps.env.JWT_ACCESS_SECRET,
  });
  const authController = createAuthController({
    service: authService,
    secureCookie: deps.env.COOKIE_SECURE,
  });
  const passwordResetController = createPasswordResetController({
    service: createPasswordResetService({
      repository,
      clock: deps.clock,
      otpHasher: deps.otpHasher ?? createOtpHasher({ secret: deps.env.OTP_HMAC_SECRET }),
      passwordHasher,
      emailService: deps.emailService,
      logger: deps.logger,
    }),
  });

  app.use('/api/v1', healthRouter);
  app.use(
    '/api/v1/auth',
    createAuthRouter({
      controller: authController,
      passwordResetController,
      appOrigin: deps.env.APP_ORIGIN,
      secureCookie: deps.env.COOKIE_SECURE,
    }),
  );

  const requireAuth = createRequireAuth({
    secret: deps.env.JWT_ACCESS_SECRET,
    clock: deps.clock,
  });

  // Before the notes router, which would run requireAuth on /notes/:noteId/shares first.
  app.use(
    '/api/v1',
    createSharesRouter({
      controller: createSharesController({
        service: createSharesService({
          repository: createSharesRepository(deps.prisma),
          clock: deps.clock,
        }),
      }),
      requireAuth,
    }),
  );
  // Also before the notes router, whose router-level requireAuth would otherwise see these paths.
  app.use(
    '/api/v1/notes',
    createVersionsRouter({
      controller: createVersionsController({
        service: createVersionsService({
          notesRepository: createNotesRepository(deps.prisma),
          versionsRepository: createVersionsRepository(deps.prisma),
          clock: deps.clock,
        }),
      }),
      requireAuth,
    }),
  );

  app.use(
    '/api/v1/notes',
    createNotesRouter({
      controller: createNotesController({
        service: createNotesService({
          repository: createNotesRepository(deps.prisma),
          clock: deps.clock,
        }),
      }),
      requireAuth,
    }),
  );
  app.use(
    '/api/v1/search',
    createSearchRouter({
      controller: createSearchController({
        service: createSearchService({ repository: createSearchRepository(deps.prisma) }),
      }),
      requireAuth,
    }),
  );

  const tagsController = createTagsController({
    service: createTagsService({ repository: createTagsRepository(deps.prisma) }),
  });
  app.use('/api/v1/tags', createTagsRouter({ controller: tagsController, requireAuth }));
  app.use('/api/v1/notes', createNoteTagsRouter({ controller: tagsController, requireAuth }));

  app.use(notFoundHandler);
  app.use(createErrorHandler(deps.logger));
  return app;
};
