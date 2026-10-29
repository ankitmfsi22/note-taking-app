import {
  ACCESS_TOKEN_TTL_SECONDS,
  AuthResponseSchema,
  type LoginRequest,
  type RegisterRequest,
} from '@note-app/shared';
import type { RequestHandler, Response } from 'express';
import { validBody } from '../../common/http/validate.js';
import type { AuthService } from './auth.service.js';
import { setRefreshCookie } from './refresh-cookie.js';

export const createAuthController = ({
  service,
  secureCookie,
}: {
  service: AuthService;
  secureCookie: boolean;
}) => {
  // Parsing with the shared schema strips any field it does not list, as a last guard (S-03).
  const respond = (
    res: Response,
    status: number,
    { user, accessToken, refreshToken }: Awaited<ReturnType<AuthService['login']>>,
  ): void => {
    setRefreshCookie(res, refreshToken, secureCookie);
    res
      .status(status)
      .json(AuthResponseSchema.parse({ user, accessToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS }));
  };

  return {
    register: (async (_req, res) => {
      respond(res, 201, await service.register(validBody<RegisterRequest>(res)));
    }) satisfies RequestHandler,

    login: (async (_req, res) => {
      respond(res, 200, await service.login(validBody<LoginRequest>(res)));
    }) satisfies RequestHandler,
  };
};

export type AuthController = ReturnType<typeof createAuthController>;
