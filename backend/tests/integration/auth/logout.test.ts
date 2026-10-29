import type { Express } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { generateRefreshToken } from '../../../src/common/security/tokens.js';
import { useTestDatabase } from '../../support/db.js';
import { clearsCookie, refreshTokenRowOf } from '../../support/refresh-tokens.js';
import { createTestApp, refreshCookieOf, registerUser } from '../../support/test-app.js';

const prisma = useTestDatabase();

const logout = (app: Express, cookie?: string) => {
  const call = request(app).post('/api/v1/auth/logout');
  return cookie === undefined ? call : call.set('Cookie', cookie);
};

const refresh = (app: Express, cookie: string) =>
  request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);

const rowOf = (cookiePair: string) => refreshTokenRowOf(prisma, cookiePair);

const allRows = () => prisma.refreshToken.findMany({ orderBy: { id: 'asc' } });

describe('POST /api/v1/auth/logout', () => {
  it('S-AB1002-24: logout revokes the token and keeps other devices signed in', async () => {
    const { app } = createTestApp({ prisma });
    const { response: registered, credentials } = await registerUser(app);
    const sessionA = refreshCookieOf(registered) ?? '';
    const sessionB =
      refreshCookieOf(await request(app).post('/api/v1/auth/login').send(credentials)) ?? '';

    const response = await logout(app, sessionA);

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect(clearsCookie(response)).toBe(true);
    expect((await rowOf(sessionA)).revokedAt).not.toBeNull();
    expect((await rowOf(sessionB)).revokedAt).toBeNull();
    expect((await refresh(app, sessionB)).status).toBe(200);
  });

  it('S-AB1002-25: logout with an unknown, revoked or missing cookie is a no-op success', async () => {
    const { app } = createTestApp({ prisma });
    const { response: registered } = await registerUser(app);
    const revoked = refreshCookieOf(registered) ?? '';
    await logout(app, revoked);
    const before = await allRows();

    const responses = [
      await logout(app, `refresh_token=${generateRefreshToken()}`),
      await logout(app, revoked),
      await logout(app),
    ];

    for (const response of responses) {
      expect(response.status).toBe(204);
      expect(clearsCookie(response)).toBe(true);
    }
    expect(await allRows()).toEqual(before);
  });
});
