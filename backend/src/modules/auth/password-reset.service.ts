import { OTP_MAX_ATTEMPTS, OTP_TTL_MINUTES, type ResetPasswordRequest } from '@note-app/shared';
import type { Logger } from 'pino';
import type { Clock } from '../../common/clock.js';
import { AppError } from '../../common/errors/app-error.js';
import type { OtpHasher, PasswordHasher } from '../../common/security/hash.js';
import { generateOtp as defaultGenerateOtp } from '../../common/security/tokens.js';
import type { EmailService } from '../email/email.service.js';
import type { AuthRepository } from './auth.repository.js';

const OTP_TTL_MS = OTP_TTL_MINUTES * 60 * 1000;

// One factory for every rejected reset (wrong, expired, used, invalidated, unknown account), so
// neither the code nor the message tells them apart (ERR-PWD-02 to 07).
const invalidOtp = () => new AppError('OTP_INVALID_OR_EXPIRED', 'Invalid or expired code');

interface PasswordResetDeps {
  repository: AuthRepository;
  clock: Clock;
  otpHasher: OtpHasher;
  passwordHasher: PasswordHasher;
  emailService: EmailService;
  logger: Logger;
  generateOtp?: () => string;
}

export const createPasswordResetService = ({
  repository,
  clock,
  otpHasher,
  passwordHasher,
  emailService,
  logger,
  generateOtp = defaultGenerateOtp,
}: PasswordResetDeps) => ({
  // Returns the same way for a known and an unknown email; the controller always answers 204.
  requestOtp: async (email: string): Promise<void> => {
    const user = await repository.findUserByEmail(email);
    if (user === null) return;

    const otp = generateOtp();
    const now = clock.now();
    // Invalidating and creating together leaves at most one usable OTP per user (AC-PWD-05).
    await repository.transaction(async (tx) => {
      await tx.invalidateUnusedOtps(user.id, now);
      await tx.createOtp({
        userId: user.id,
        otpHash: otpHasher.hash(user.id, otp),
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      });
    });

    // Sent after the commit, so no OTP is delivered for a rolled-back row. A failure must not
    // change the response (S-AB1003-25), so it is logged and swallowed. Only the error name is
    // logged: a delivery error message could hold the email address or the OTP.
    try {
      await emailService.sendOtp(user.email, otp);
    } catch (error) {
      logger.error(
        { errorName: error instanceof Error ? error.name : typeof error },
        'password reset OTP delivery failed',
      );
    }
  },

  // The route has validated all fields, so a malformed request never counts as an attempt.
  resetPassword: async ({ email, otp, newPassword }: ResetPasswordRequest): Promise<void> => {
    const user = await repository.findUserByEmail(email);
    if (user === null) {
      // The same HMAC work as a real check, then the same error as a wrong code.
      otpHasher.verifyDummy(otp);
      throw invalidOtp();
    }

    // The callback never throws: an error would roll back the counted attempt, so the outcome is
    // returned and the error is raised only after the commit (SDS 5.5).
    const outcome = await repository.transaction(async (tx) => {
      const now = clock.now();
      const candidate = await tx.findLatestOtp(user.id);
      if (candidate === null) {
        otpHasher.verifyDummy(otp);
        return 'invalid' as const;
      }

      // The attempt is claimed before the code is compared. The claim is one atomic UPDATE, so
      // parallel guesses cannot pass the limit, and it locks the row against a concurrent reset.
      if ((await tx.claimOtpAttempt(candidate.id, user.id, now, OTP_MAX_ATTEMPTS)) === 0) {
        otpHasher.verifyDummy(otp);
        return 'invalid' as const;
      }

      if (!otpHasher.matches(candidate.otpHash, user.id, otp)) {
        const claimed = await tx.findOtp(candidate.id, user.id);
        if (claimed !== null && claimed.attempts >= OTP_MAX_ATTEMPTS) {
          await tx.invalidateOtp(candidate.id, user.id, now);
        }
        return 'invalid' as const;
      }

      if ((await tx.markOtpUsed(candidate.id, user.id, now)) === 0) return 'invalid' as const;
      // Hashed only after a match, so wrong guesses cost no Argon2 work.
      await tx.updatePasswordHash(user.id, await passwordHasher.hash(newPassword));
      // Every session ends; the user is not logged in by the reset (AC-PWD-08).
      await tx.revokeAllActiveForUser(user.id, now);
      return 'ok' as const;
    });

    if (outcome !== 'ok') throw invalidOtp();
  },
});

export type PasswordResetService = ReturnType<typeof createPasswordResetService>;
