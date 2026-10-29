import { ErrorResponseSchema } from '@note-app/shared';
import type { Express } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createOtpHasher, createPasswordHasher } from '../../../src/common/security/hash.js';
import { useTestDatabase } from '../../support/db.js';
import { createSpyEmailService } from '../../support/email.js';
import {
  createMutableClock,
  createTestApp,
  createTestEnv,
  refreshCookieOf,
  registerUser,
} from '../../support/test-app.js';

const prisma = useTestDatabase();

const EMAIL = 'ada@example.com';
const OLD_PASSWORD = 'OldPass1';
const NEW_PASSWORD = 'NewPass2';
const START = '2026-10-29T09:00:00.000Z';
const TEN_MINUTES_MS = 10 * 60 * 1000;

const errorOf = (body: unknown) => ErrorResponseSchema.parse(body).error;
const fieldsOf = (body: unknown) => (errorOf(body).details ?? []).map((detail) => detail.field);

const postReset = (app: Express, body: object) =>
  request(app).post('/api/v1/auth/reset-password').send(body);

// Any 6-digit code other than the real one.
const wrongOtp = (otp: string) => (otp === '000000' ? '111111' : '000000');

const verifyPassword = async (userId: string, password: string) => {
  const { passwordHash } = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return createPasswordHasher({ memoryCost: 1024, timeCost: 1 }).verify(passwordHash, password);
};

// A registered user with OLD_PASSWORD, ready to request OTPs.
const setup = async (overrides: Parameters<typeof createTestApp>[0] = {}) => {
  const emailService = createSpyEmailService();
  const clock = createMutableClock(START);
  const testApp = createTestApp({ prisma, emailService, clock, ...overrides });
  const { response: registered } = await registerUser(testApp.app, {
    email: EMAIL,
    password: OLD_PASSWORD,
  });
  const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });

  const requestOtp = async (): Promise<string> => {
    await request(testApp.app).post('/api/v1/auth/forgot-password').send({ email: EMAIL });
    return emailService.otpFor(EMAIL);
  };
  const reset = (otp: string, newPassword = NEW_PASSWORD) =>
    postReset(testApp.app, { email: EMAIL, otp, newPassword });
  const latestOtpRow = () =>
    prisma.passwordResetOtp.findFirstOrThrow({
      where: { userId: user.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

  return { ...testApp, clock, user, registered, requestOtp, reset, latestOtpRow };
};

describe('POST /api/v1/auth/reset-password', () => {
  it('S-AB1003-05: a new OTP invalidates the earlier unused OTP', async () => {
    const { requestOtp, reset, user } = await setup();
    const first = await requestOtp();
    const second = await requestOtp();

    const response = await reset(first);

    expect(response.status).toBe(400);
    expect(errorOf(response.body).code).toBe('OTP_INVALID_OR_EXPIRED');
    const [firstRow] = await prisma.passwordResetOtp.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    expect(firstRow?.invalidatedAt).not.toBeNull();
    expect((await reset(second)).status).toBe(204);
  });

  it('S-AB1003-07: reset with a correct OTP changes the password and uses the OTP', async () => {
    const { requestOtp, reset, user, latestOtpRow } = await setup();
    const otp = await requestOtp();

    const response = await reset(otp);

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    const { passwordHash } = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(passwordHash).not.toBe(user.passwordHash);
    expect(passwordHash).toMatch(/^\$argon2id\$/);
    expect((await latestOtpRow()).usedAt).toEqual(new Date(START));
  });

  it('S-AB1003-08: reset revokes every refresh token and does not log in', async () => {
    const { app, requestOtp, reset, user, registered } = await setup();
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, password: OLD_PASSWORD });
    const cookies = [refreshCookieOf(registered), refreshCookieOf(login)];
    const otp = await requestOtp();

    const response = await reset(otp);

    expect(response.status).toBe(204);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.text).not.toContain('accessToken');
    const rows = await prisma.refreshToken.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.revokedAt !== null)).toBe(true);
    for (const cookie of cookies) {
      const refreshed = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie ?? '');
      expect(refreshed.status).toBe(401);
      expect(errorOf(refreshed.body).code).toBe('INVALID_REFRESH_TOKEN');
    }
  });

  it('S-AB1003-09: the old password stops working after a reset', async () => {
    const { app, requestOtp, reset } = await setup();
    await reset(await requestOtp());

    const withOld = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, password: OLD_PASSWORD });
    const withNew = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, password: NEW_PASSWORD });

    expect(withOld.status).toBe(401);
    expect(errorOf(withOld.body).code).toBe('INVALID_CREDENTIALS');
    expect(withNew.status).toBe(200);
  });

  it('S-AB1003-10: a used OTP is rejected', async () => {
    const { requestOtp, reset, user } = await setup();
    const otp = await requestOtp();
    await reset(otp);

    const again = await reset(otp, 'Another3');

    expect(again.status).toBe(400);
    expect(errorOf(again.body).code).toBe('OTP_INVALID_OR_EXPIRED');
    expect(await verifyPassword(user.id, NEW_PASSWORD)).toBe(true);
  });

  it('S-AB1003-11: a wrong OTP is rejected and counted', async () => {
    const { requestOtp, reset, user, latestOtpRow } = await setup();
    const otp = await requestOtp();

    const response = await reset(wrongOtp(otp));

    expect(response.status).toBe(400);
    expect(errorOf(response.body).code).toBe('OTP_INVALID_OR_EXPIRED');
    const row = await latestOtpRow();
    expect(row.attempts).toBe(1);
    expect(row.usedAt).toBeNull();
    expect(await verifyPassword(user.id, OLD_PASSWORD)).toBe(true);
  });

  it('S-AB1003-12: an expired OTP is rejected', async () => {
    const { requestOtp, reset, user, clock } = await setup();
    const otp = await requestOtp();
    clock.advanceMs(TEN_MINUTES_MS);

    const response = await reset(otp);

    expect(response.status).toBe(400);
    expect(errorOf(response.body).code).toBe('OTP_INVALID_OR_EXPIRED');
    expect(await verifyPassword(user.id, OLD_PASSWORD)).toBe(true);
  });

  it('S-AB1003-13: a weak new password is rejected and the OTP stays usable', async () => {
    const { requestOtp, reset, latestOtpRow } = await setup();
    const otp = await requestOtp();

    for (const weak of ['short1', '12345678', 'abcdefgh', `${'a'.repeat(128)}1`]) {
      const response = await reset(otp, weak);
      expect(response.status).toBe(400);
      expect(errorOf(response.body).code).toBe('VALIDATION_ERROR');
      expect(fieldsOf(response.body)).toContain('newPassword');
    }

    const row = await latestOtpRow();
    expect(row.attempts).toBe(0);
    expect(row.usedAt).toBeNull();
    expect((await reset(otp)).status).toBe(204);
  });

  it('S-AB1003-14: a reset for an unknown email returns the wrong-OTP error', async () => {
    const otpHasher = createOtpHasher({ secret: createTestEnv().OTP_HMAC_SECRET });
    const { app, requestOtp, reset } = await setup({ otpHasher });
    const otp = await requestOtp();
    const wrong = await reset(wrongOtp(otp));
    const rowsBefore = await prisma.passwordResetOtp.findMany();
    const verifyDummy = vi.spyOn(otpHasher, 'verifyDummy');

    const unknown = await postReset(app, {
      email: 'nobody@example.com',
      otp: '123456',
      newPassword: NEW_PASSWORD,
    });

    expect(unknown.status).toBe(400);
    expect(errorOf(unknown.body).code).toBe('OTP_INVALID_OR_EXPIRED');
    expect(errorOf(unknown.body).message).toBe(errorOf(wrong.body).message);
    expect(await prisma.passwordResetOtp.findMany()).toEqual(rowsBefore);
    expect(verifyDummy).toHaveBeenCalledTimes(1);
  });

  it('rejects a reset for an account that never requested an OTP', async () => {
    const { reset, user } = await setup();

    const response = await reset('123456');

    expect(response.status).toBe(400);
    expect(errorOf(response.body).code).toBe('OTP_INVALID_OR_EXPIRED');
    expect(await verifyPassword(user.id, OLD_PASSWORD)).toBe(true);
  });

  it('S-AB1003-15: the fifth wrong attempt invalidates the OTP', async () => {
    const { requestOtp, reset, latestOtpRow } = await setup();
    const first = await requestOtp();
    for (let i = 0; i < 4; i += 1) await reset(wrongOtp(first));
    expect((await reset(first)).status).toBe(204);

    const second = await requestOtp();
    const responses = [];
    for (let i = 0; i < 5; i += 1) responses.push(await reset(wrongOtp(second)));

    const fifth = responses[4];
    expect(fifth?.status).toBe(400);
    expect(errorOf(fifth?.body).code).toBe('OTP_INVALID_OR_EXPIRED');
    const row = await latestOtpRow();
    expect(row.attempts).toBe(5);
    expect(row.invalidatedAt).not.toBeNull();
  });

  it('S-AB1003-16: after five failures a correct OTP is rejected until a new one is requested', async () => {
    const { requestOtp, reset, user } = await setup();
    const original = await requestOtp();
    for (let i = 0; i < 5; i += 1) await reset(wrongOtp(original));

    const withOriginal = await reset(original);

    expect(withOriginal.status).toBe(400);
    expect(errorOf(withOriginal.body).code).toBe('OTP_INVALID_OR_EXPIRED');
    expect(await verifyPassword(user.id, OLD_PASSWORD)).toBe(true);
    expect((await reset(await requestOtp())).status).toBe(204);
  });

  it('S-AB1003-17: an OTP that is not six digits returns 400 VALIDATION_ERROR', async () => {
    const { requestOtp, reset, latestOtpRow } = await setup();
    await requestOtp();

    for (const otp of ['12345', '1234567', '12a456']) {
      const response = await reset(otp);
      expect(response.status).toBe(400);
      expect(errorOf(response.body).code).toBe('VALIDATION_ERROR');
      expect(fieldsOf(response.body)).toContain('otp');
    }

    expect((await latestOtpRow()).attempts).toBe(0);
  });

  it('S-AB1003-18: two concurrent resets with the same OTP succeed only once', async () => {
    const { requestOtp, reset, user } = await setup();
    const otp = await requestOtp();

    const [a, b] = await Promise.all([reset(otp, 'FirstPass1'), reset(otp, 'SecondPass2')]);

    expect([a.status, b.status].sort()).toEqual([204, 400]);
    const loser = a.status === 400 ? a : b;
    expect(errorOf(loser.body).code).toBe('OTP_INVALID_OR_EXPIRED');
    const winnerPassword = a.status === 204 ? 'FirstPass1' : 'SecondPass2';
    const loserPassword = a.status === 204 ? 'SecondPass2' : 'FirstPass1';
    expect(await verifyPassword(user.id, winnerPassword)).toBe(true);
    expect(await verifyPassword(user.id, loserPassword)).toBe(false);
  });
});
