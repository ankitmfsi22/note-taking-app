import { AuthResponseSchema, ErrorResponseSchema } from '@note-app/shared';
import type { Express } from 'express';
import request, { type Response } from 'supertest';
import { describe, expect, it } from 'vitest';
import { generateRefreshToken } from '../../../src/common/security/tokens.js';
import { useTestDatabase } from '../../support/db.js';
import { clearsCookie, refreshTokenRowOf } from '../../support/refresh-tokens.js';
import {
  createMutableClock,
  createTestApp,
  refreshCookieOf,
  registerUser,
} from '../../support/test-app.js';

const prisma = useTestDatabase();

const DAY_MS = 24 * 60 * 60 * 1000;

const errorOf = (body: unknown) => ErrorResponseSchema.parse(body).error;

const refresh = (app: Express, cookie?: string) => {
  const call = request(app).post('/api/v1/auth/refresh');
  return cookie === undefined ? call : call.set('Cookie', cookie);
};

const logout = (app: Express, cookie: string) =>
  request(app).post('/api/v1/auth/logout').set('Cookie', cookie);

// A second session for a user that already exists.
const login = async (app: Express, credentials: { email: string; password: string }) => {
  const response = await request(app).post('/api/v1/auth/login').send(credentials);
  return refreshCookieOf(response) ?? '';
};

const cookiePairOf = (response: Response): string => refreshCookieOf(response) ?? '';

const rowOf = (cookiePair: string) => refreshTokenRowOf(prisma, cookiePair);

const allRows = () => prisma.refreshToken.findMany({ orderBy: { id: 'asc' } });

describe('POST /api/v1/auth/refresh', () => {
  it('S-AB1002-18: refresh rotates the refresh token', async () => {
    const { app } = createTestApp({ prisma });
    const { response: registered } = await registerUser(app);
    const oldCookie = cookiePairOf(registered);

    const response = await refresh(app, oldCookie);

    expect(response.status).toBe(200);
    expect(AuthResponseSchema.parse(response.body).accessToken).not.toBe('');
    const newCookie = cookiePairOf(response);
    expect(newCookie).toMatch(/^refresh_token=.+/);
    expect(newCookie).not.toBe(oldCookie);
    expect((await rowOf(oldCookie)).revokedAt).not.toBeNull();
    expect((await rowOf(newCookie)).revokedAt).toBeNull();
    const userId = (await rowOf(newCookie)).userId;
    expect(await prisma.refreshToken.count({ where: { userId, revokedAt: null } })).toBe(1);
    expect((await refresh(app, newCookie)).status).toBe(200);
  });

  it('S-AB1002-19: an unknown token returns 401 and revokes nothing', async () => {
    const { app } = createTestApp({ prisma });
    await registerUser(app);
    await registerUser(app);
    const before = await allRows();

    const unknown = await refresh(app, `refresh_token=${generateRefreshToken()}`);
    const missing = await refresh(app);

    for (const response of [unknown, missing]) {
      expect(response.status).toBe(401);
      expect(errorOf(response.body).code).toBe('INVALID_REFRESH_TOKEN');
      expect(clearsCookie(response)).toBe(true);
    }
    expect(await allRows()).toEqual(before);
  });

  it('S-AB1002-20: an expired token returns 401 and revokes nothing', async () => {
    const clock = createMutableClock('2026-10-28T12:00:00.000Z');
    const { app } = createTestApp({ prisma, clock });
    const { response: registered, credentials } = await registerUser(app);
    const expiredCookie = cookiePairOf(registered);
    clock.advanceMs(6 * DAY_MS);
    const otherSession = await login(app, credentials);
    clock.advanceMs(DAY_MS + 1000);
    const before = await allRows();

    const response = await refresh(app, expiredCookie);

    expect(response.status).toBe(401);
    expect(errorOf(response.body).code).toBe('INVALID_REFRESH_TOKEN');
    expect(clearsCookie(response)).toBe(true);
    expect(await allRows()).toEqual(before);
    expect((await rowOf(otherSession)).revokedAt).toBeNull();
  });

  it('S-AB1002-21: two concurrent refreshes with one token let exactly one win', async () => {
    const { app } = createTestApp({ prisma });
    const { response: registered } = await registerUser(app);
    const cookie = cookiePairOf(registered);
    const userId = (await rowOf(cookie)).userId;
    const before = await prisma.refreshToken.count();

    const responses = await Promise.all([refresh(app, cookie), refresh(app, cookie)]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 401]);
    const loser = responses.find((response) => response.status === 401);
    expect(errorOf(loser?.body).code).toBe('INVALID_REFRESH_TOKEN');
    expect(await prisma.refreshToken.count()).toBe(before + 1);
    // The loser takes the reuse path, so the winner's new token is revoked too (SDS 10.5).
    expect(await prisma.refreshToken.count({ where: { userId, revokedAt: null } })).toBe(0);
  });

  it("S-AB1002-22: reuse of a rotated token revokes all of the user's tokens", async () => {
    const { app } = createTestApp({ prisma });
    const { response: registered, credentials } = await registerUser(app);
    const { response: otherUser } = await registerUser(app);
    const oldA = cookiePairOf(registered);
    const sessionB = await login(app, credentials);
    const newA = cookiePairOf(await refresh(app, oldA));

    const response = await refresh(app, oldA);

    expect(response.status).toBe(401);
    expect(errorOf(response.body).code).toBe('INVALID_REFRESH_TOKEN');
    expect(clearsCookie(response)).toBe(true);
    for (const cookie of [oldA, newA, sessionB]) {
      expect((await rowOf(cookie)).revokedAt).not.toBeNull();
    }
    expect((await refresh(app, sessionB)).status).toBe(401);
    expect((await rowOf(cookiePairOf(otherUser))).revokedAt).toBeNull();
  });

  it('S-AB1002-23: a logged-out token returns 401 and revokes nothing else', async () => {
    const { app } = createTestApp({ prisma });
    const { response: registered, credentials } = await registerUser(app);
    const sessionA = cookiePairOf(registered);
    const sessionB = await login(app, credentials);
    await logout(app, sessionA);

    const response = await refresh(app, sessionA);

    expect(response.status).toBe(401);
    expect(errorOf(response.body).code).toBe('INVALID_REFRESH_TOKEN');
    expect(clearsCookie(response)).toBe(true);
    expect((await rowOf(sessionB)).revokedAt).toBeNull();
    expect((await refresh(app, sessionB)).status).toBe(200);
  });
});
