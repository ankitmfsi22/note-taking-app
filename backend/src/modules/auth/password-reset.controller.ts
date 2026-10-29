import type { ForgotPasswordRequest, ResetPasswordRequest } from '@note-app/shared';
import type { RequestHandler } from 'express';
import { validBody } from '../../common/http/validate.js';
import type { PasswordResetService } from './password-reset.service.js';

export const createPasswordResetController = ({ service }: { service: PasswordResetService }) => ({
  // One response for every account state, so the status and headers reveal nothing (AC-PWD-02).
  forgotPassword: (async (_req, res) => {
    await service.requestOtp(validBody<ForgotPasswordRequest>(res).email);
    res.status(204).end();
  }) satisfies RequestHandler,

  // No cookie and no token: the user logs in again with the new password (AC-PWD-08).
  resetPassword: (async (_req, res) => {
    await service.resetPassword(validBody<ResetPasswordRequest>(res));
    res.status(204).end();
  }) satisfies RequestHandler,
});

export type PasswordResetController = ReturnType<typeof createPasswordResetController>;
