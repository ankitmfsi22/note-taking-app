import { LoginRequestSchema, RegisterRequestSchema } from '@note-app/shared';
import cookieParser from 'cookie-parser';
import { Router } from 'express';
import { validate } from '../../common/http/validate.js';
import type { AuthController } from './auth.controller.js';

export const createAuthRouter = ({ controller }: { controller: AuthController }): Router => {
  const router = Router();

  // Only this router reads cookies, so the parser stays off every other route.
  router.use(cookieParser());

  router.post('/register', validate({ body: RegisterRequestSchema }), controller.register);
  router.post('/login', validate({ body: LoginRequestSchema }), controller.login);

  return router;
};
