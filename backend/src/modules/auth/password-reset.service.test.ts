import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { createOtpHasher, createPasswordHasher } from '../../common/security/hash.js';
import { generateOtp } from '../../common/security/tokens.js';
import type { AuthRepository } from './auth.repository.js';
import { createPasswordResetService } from './password-reset.service.js';

const NOW = new Date('2026-10-29T09:00:00.000Z');
const USER = { id: '0192b7c4-5a1e-7c3a-9d2f-3b8e6f1a4c70', email: 'ada@example.com' };

describe('password reset service', () => {
  it('S-AB1003-03: the OTP is six digits and expires after ten minutes', async () => {
    const created: { expiresAt: Date }[] = [];
    const sent: string[] = [];
    const methods = {
      findUserByEmail: () => Promise.resolve(USER),
      invalidateUnusedOtps: () => Promise.resolve(0),
      createOtp: (data: { expiresAt: Date }) => {
        created.push(data);
        return Promise.resolve(data);
      },
    };
    const repository = {
      ...methods,
      transaction: <T>(fn: (tx: typeof methods) => Promise<T>) => fn(methods),
    } as unknown as AuthRepository;

    const service = createPasswordResetService({
      repository,
      clock: { now: () => new Date(NOW) },
      otpHasher: createOtpHasher({ secret: 'test-only-otp-hmac-secret-at-least-32-bytes' }),
      passwordHasher: createPasswordHasher({ memoryCost: 1024, timeCost: 1 }),
      emailService: {
        sendOtp: (_email, otp) => {
          sent.push(otp);
          return Promise.resolve();
        },
      },
      logger: pino({ enabled: false }),
      // The real generator, forced below 100000, so the padding is exercised end to end.
      generateOtp: () => generateOtp(() => 4217),
    });

    await service.requestOtp(USER.email);

    expect(sent).toEqual(['004217']);
    expect(created).toHaveLength(1);
    expect(sent[0]).toMatch(/^\d{6}$/);
    expect(created[0]?.expiresAt).toEqual(new Date(NOW.getTime() + 10 * 60 * 1000));
  });
});
