import { OTP_TTL_MINUTES } from '@note-app/shared';
import type { Logger } from 'pino';
import type { Clock } from '../../common/clock.js';
import type { OtpHasher, PasswordHasher } from '../../common/security/hash.js';
import { generateOtp as defaultGenerateOtp } from '../../common/security/tokens.js';
import type { EmailService } from '../email/email.service.js';
import type { AuthRepository } from './auth.repository.js';

const OTP_TTL_MS = OTP_TTL_MINUTES * 60 * 1000;

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
});

export type PasswordResetService = ReturnType<typeof createPasswordResetService>;
