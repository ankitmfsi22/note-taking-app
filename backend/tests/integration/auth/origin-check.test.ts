import { ErrorResponseSchema } from '@note-app/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../support/db.js';
import { refreshTokenRowOf } from '../../support/refresh-tokens.js';
import {
  createTestApp,
  refreshCookieOf,
  registerUser,
  TEST_APP_ORIGIN,
} from '../../support/test-app.js';

const prisma = useTestDatabase();

const FOREIGN_ORIGIN = 'https://evil.example';

const allRows = () => prisma.refreshToken.findMany({ orderBy: { id: 'asc' } });

describe('origin check on the cookie endpoints', () => {
  it('S-AB1002-26: refresh from a foreign origin returns 403 FORBIDDEN_ORIGIN', async () => {
    const { app } = createTestApp({ prisma });
    const { response: registered } = await registerUser(app);
    const cookie = refreshCookieOf(registered) ?? '';
    const before = await allRows();

    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', FOREIGN_ORIGIN)
      .set('Cookie', cookie);

    expect(response.status).toBe(403);
    expect(ErrorResponseSchema.parse(response.body).error.code).toBe('FORBIDDEN_ORIGIN');
    expect((await refreshTokenRowOf(prisma, cookie)).revokedAt).toBeNull();
    expect(await allRows()).toEqual(before);
  });

  it('S-AB1002-27: logout from a foreign origin returns 403 FORBIDDEN_ORIGIN', async () => {
    const { app } = createTestApp({ prisma });
    const { response: registered } = await registerUser(app);
    const cookie = refreshCookieOf(registered) ?? '';
    const before = await allRows();

    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('Origin', FOREIGN_ORIGIN)
      .set('Cookie', cookie);

    expect(response.status).toBe(403);
    expect(ErrorResponseSchema.parse(response.body).error.code).toBe('FORBIDDEN_ORIGIN');
    expect((await refreshTokenRowOf(prisma, cookie)).revokedAt).toBeNull();
    expect(await allRows()).toEqual(before);
  });

  it('S-AB1002-28: matching or absent Origin is allowed', async () => {
    const { app } = createTestApp({ prisma });
    const { response: registered } = await registerUser(app);

    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', TEST_APP_ORIGIN)
      .set('Cookie', refreshCookieOf(registered) ?? '');
    const loggedOut = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', refreshCookieOf(refreshed) ?? '');

    expect(refreshed.status).toBe(200);
    expect(loggedOut.status).toBe(204);
  });
});
