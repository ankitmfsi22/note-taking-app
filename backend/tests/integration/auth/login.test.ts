import { createHash } from 'node:crypto';
import { AuthResponseSchema, ErrorResponseSchema } from '@note-app/shared';
import { jwtVerify } from 'jose';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createPasswordHasher } from '../../../src/common/security/hash.js';
import { useTestDatabase } from '../../support/db.js';
import {
  createTestApp,
  createTestEnv,
  refreshCookieOf,
  registerUser,
  TEST_PASSWORD,
} from '../../support/test-app.js';

const prisma = useTestDatabase();

const FIXED_NOW = new Date('2026-10-28T12:00:00.000Z');

const errorOf = (body: unknown) => ErrorResponseSchema.parse(body).error;

const postLogin = (app: ReturnType<typeof createTestApp>['app'], body: object) =>
  request(app).post('/api/v1/auth/login').send(body);

const setCookieHeader = (response: request.Response): string => {
  const header: unknown = response.headers['set-cookie'];
  const cookie = Array.isArray(header)
    ? header.map(String).find((value) => value.startsWith('refresh_token='))
    : undefined;
  if (cookie === undefined) throw new Error('response has no refresh_token Set-Cookie');
  return cookie;
};

// The `;`-separated parts of the refresh cookie: the name=value pair first, then its attributes.
const cookieParts = (response: request.Response): string[] =>
  setCookieHeader(response)
    .split(';')
    .map((part) => part.trim());

describe('POST /api/v1/auth/login', () => {
  it('S-AB1002-12: login with correct credentials returns tokens', async () => {
    const { app, env } = createTestApp({ prisma });
    const { credentials } = await registerUser(app);

    const response = await postLogin(app, credentials);

    expect(response.status).toBe(200);
    const body = AuthResponseSchema.parse(response.body);
    expect(body.expiresIn).toBe(900);
    const { payload, protectedHeader } = await jwtVerify(
      body.accessToken,
      new TextEncoder().encode(env.JWT_ACCESS_SECRET),
      {
        algorithms: ['HS256'],
        issuer: 'note-app',
        audience: 'note-app-api',
        currentDate: FIXED_NOW,
      },
    );
    expect(protectedHeader.alg).toBe('HS256');
    expect(payload.sub).toBe(body.user.id);
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(900);
  });

  it('S-AB1002-13: refresh token is stored hashed with a 7-day expiry', async () => {
    const { app } = createTestApp({ prisma });
    const { credentials } = await registerUser(app);
    const before = await prisma.refreshToken.count();

    const response = await postLogin(app, credentials);

    const rawToken = (refreshCookieOf(response) ?? '').replace('refresh_token=', '');
    expect(rawToken).not.toBe('');
    expect(await prisma.refreshToken.count()).toBe(before + 1);
    const row = await prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash: createHash('sha256').update(rawToken).digest('hex') },
    });
    expect(row.expiresAt).toEqual(new Date('2026-11-04T12:00:00.000Z'));
    expect(row.revokedAt).toBeNull();
    expect(JSON.stringify(row)).not.toContain(rawToken);
  });

  it('S-AB1002-14: refresh cookie has the required attributes', async () => {
    const plain = createTestApp({ prisma });
    const { credentials } = await registerUser(plain.app);
    const secure = createTestApp({ prisma, env: createTestEnv({ COOKIE_SECURE: 'true' }) });

    const plainResponse = await postLogin(plain.app, credentials);
    const secureResponse = await postLogin(secure.app, credentials);

    for (const response of [plainResponse, secureResponse]) {
      const attributes = cookieParts(response);
      expect(attributes[0]).toMatch(/^refresh_token=.+/);
      expect(attributes).toEqual(
        expect.arrayContaining([
          'HttpOnly',
          'SameSite=Strict',
          'Path=/api/v1/auth',
          'Max-Age=604800',
        ]),
      );
      const value = attributes[0]?.replace('refresh_token=', '') ?? '';
      expect(JSON.stringify(response.body)).not.toContain(value);
      for (const [name, header] of Object.entries(response.headers)) {
        if (name !== 'set-cookie') expect(String(header)).not.toContain(value);
      }
    }
    expect(cookieParts(plainResponse)).not.toContain('Secure');
    expect(cookieParts(secureResponse)).toContain('Secure');
  });

  it('S-AB1002-15: login with missing fields returns 400 VALIDATION_ERROR', async () => {
    const { app } = createTestApp({ prisma });

    for (const body of [{}, { email: 'a@b.co' }]) {
      const response = await postLogin(app, body);

      expect(response.status).toBe(400);
      expect(errorOf(response.body).code).toBe('VALIDATION_ERROR');
    }
    expect(await prisma.refreshToken.count()).toBe(0);
  });

  it('S-AB1002-16: wrong password returns 401 INVALID_CREDENTIALS', async () => {
    const { app } = createTestApp({ prisma });
    const { credentials } = await registerUser(app);
    const before = await prisma.refreshToken.count();

    const response = await postLogin(app, { ...credentials, password: 'wrong-horse-9' });

    expect(response.status).toBe(401);
    expect(errorOf(response.body).code).toBe('INVALID_CREDENTIALS');
    expect(refreshCookieOf(response)).toBeUndefined();
    expect(await prisma.refreshToken.count()).toBe(before);
  });

  it('S-AB1002-17: unknown email returns the same error as a wrong password', async () => {
    const { env } = createTestApp();
    const passwordHasher = createPasswordHasher({
      memoryCost: env.ARGON2_MEMORY_KIB,
      timeCost: env.ARGON2_TIME_COST,
    });
    const verifyDummy = vi.spyOn(passwordHasher, 'verifyDummy');
    const verify = vi.spyOn(passwordHasher, 'verify');
    const { app } = createTestApp({ prisma, passwordHasher });
    const { credentials } = await registerUser(app);

    const wrongPassword = await postLogin(app, { ...credentials, password: 'wrong-horse-9' });
    expect(verifyDummy).not.toHaveBeenCalled();
    const unknownEmail = await postLogin(app, {
      email: 'nobody@example.com',
      password: TEST_PASSWORD,
    });

    expect(unknownEmail.status).toBe(wrongPassword.status);
    expect(errorOf(unknownEmail.body).code).toBe(errorOf(wrongPassword.body).code);
    expect(errorOf(unknownEmail.body).message).toBe(errorOf(wrongPassword.body).message);
    expect(verifyDummy).toHaveBeenCalledOnce();
    expect(verify).toHaveBeenCalledOnce();
  });
});
