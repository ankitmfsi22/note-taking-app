import {
  ForgotPasswordRequestSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
} from '@note-app/shared';
import cookieParser from 'cookie-parser';
import { Router, type ErrorRequestHandler } from 'express';
import { AppError } from '../../common/errors/app-error.js';
import { createOriginCheck } from '../../common/http/origin-check.js';
import { validate } from '../../common/http/validate.js';
import type { AuthController } from './auth.controller.js';
import type { PasswordResetController } from './password-reset.controller.js';
import { clearRefreshCookie } from './refresh-cookie.js';

export const createAuthRouter = ({
  controller,
  passwordResetController,
  appOrigin,
  secureCookie,
}: {
  controller: AuthController;
  passwordResetController: PasswordResetController;
  appOrigin: string;
  secureCookie: boolean;
}): Router => {
  const router = Router();
  const originCheck = createOriginCheck(appOrigin);

  // Only this router reads cookies, so the parser stays off every other route.
  router.use(cookieParser());

  router.post('/register', validate({ body: RegisterRequestSchema }), controller.register);
  router.post('/login', validate({ body: LoginRequestSchema }), controller.login);
  // The origin check runs first, so a foreign origin never reaches the cookie (SA-05).
  router.post('/refresh', originCheck, controller.refresh);
  router.post('/logout', originCheck, controller.logout);
  // Public and cookie-free, so no origin check (SDS 7.1).
  router.post(
    '/forgot-password',
    validate({ body: ForgotPasswordRequestSchema }),
    passwordResetController.forgotPassword,
  );

  // A refused refresh token also clears the browser's copy. The global error middleware still
  // builds the response body.
  router.use(((err, _req, res, next) => {
    if (err instanceof AppError && err.code === 'INVALID_REFRESH_TOKEN') {
      clearRefreshCookie(res, secureCookie);
    }
    next(err);
  }) satisfies ErrorRequestHandler);

  return router;
};
