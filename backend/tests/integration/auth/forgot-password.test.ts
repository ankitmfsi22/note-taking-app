import { createHash, createHmac } from 'node:crypto';
import { ErrorResponseSchema } from '@note-app/shared';
import type { Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../support/db.js';
import { createSpyEmailService } from '../../support/email.js';
import { createTestApp, registerUser } from '../../support/test-app.js';

const prisma = useTestDatabase();

const EMAIL = 'ada@example.com';

const postForgot = (app: Express, body: object) =>
  request(app).post('/api/v1/auth/forgot-password').send(body);

const setup = (options: { reject?: boolean } = {}) => {
  const emailService = createSpyEmailService(options);
  return { emailService, ...createTestApp({ prisma, emailService }) };
};

describe('POST /api/v1/auth/forgot-password', () => {
  it('S-AB1003-01: forgot-password for a known email returns 204 and sends the OTP', async () => {
    const { app, emailService } = setup();
    await registerUser(app, { email: EMAIL });

    const response = await postForgot(app, { email: EMAIL });

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(await prisma.passwordResetOtp.count({ where: { userId: user.id } })).toBe(1);
    expect(emailService.calls).toHaveLength(1);
    expect(emailService.calls[0]?.email).toBe(EMAIL);
    expect(emailService.calls[0]?.otp).toMatch(/^\d{6}$/);
  });

  it('S-AB1003-02: known and unknown email give an identical response', async () => {
    const { app, emailService } = setup();
    await registerUser(app, { email: EMAIL });

    const known = await postForgot(app, { email: EMAIL });
    const unknown = await postForgot(app, { email: 'nobody@example.com' });

    expect(unknown.status).toBe(204);
    expect(known.status).toBe(204);
    expect(unknown.text).toBe('');
    expect(known.text).toBe('');
    expect(Object.keys(unknown.headers).sort()).toEqual(Object.keys(known.headers).sort());
    expect(await prisma.passwordResetOtp.count()).toBe(1);
    expect(emailService.calls.map((call) => call.email)).toEqual([EMAIL]);
  });

  it('S-AB1003-04: the OTP is stored only as an HMAC', async () => {
    const { app, env, emailService } = setup();
    await registerUser(app, { email: EMAIL });

    await postForgot(app, { email: EMAIL });

    const otp = emailService.otpFor(EMAIL);
    const row = await prisma.passwordResetOtp.findFirstOrThrow();
    const expected = createHmac('sha256', env.OTP_HMAC_SECRET)
      .update(`${row.userId}:${otp}`)
      .digest('hex');
    expect(row.otpHash).toBe(expected);
    expect(row.otpHash).not.toBe(createHash('sha256').update(otp).digest('hex'));
    expect(Object.values(row).map(String)).not.toContain(otp);
  });

  it('S-AB1003-06: forgot-password with a malformed email returns 400 VALIDATION_ERROR', async () => {
    const { app } = setup();

    const response = await postForgot(app, { email: 'not-an-email' });

    expect(response.status).toBe(400);
    const { error } = ErrorResponseSchema.parse(response.body);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details?.map((detail) => detail.field)).toContain('email');
    expect(await prisma.passwordResetOtp.count()).toBe(0);
  });

  it('S-AB1003-25: an email delivery failure does not change the forgot-password response', async () => {
    const { app, logs, emailService } = setup({ reject: true });
    await registerUser(app, { email: EMAIL });
    const before = logs.lines().length;

    const response = await postForgot(app, { email: EMAIL });

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    const requestLogs = logs.lines().slice(before).join('');
    expect(requestLogs).toContain('password reset OTP delivery failed');
    expect(requestLogs).not.toContain(EMAIL);
    expect(requestLogs).not.toContain(emailService.otpFor(EMAIL));
  });
});
