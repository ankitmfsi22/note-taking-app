import { AuthResponseSchema } from '@note-app/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../support/db.js';
import {
  createTestApp,
  refreshCookieOf,
  registerUser,
  TEST_PASSWORD,
} from '../../support/test-app.js';

const prisma = useTestDatabase();

describe('auth response bodies', () => {
  it('S-AB1002-03: responses never contain a password or hash', async () => {
    const { app } = createTestApp({ prisma });
    const { response: registered, credentials } = await registerUser(app, {
      displayName: 'Ada',
    });
    const loggedIn = await request(app).post('/api/v1/auth/login').send(credentials);
    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookieOf(registered) ?? '');
    const { passwordHash } = await prisma.user.findUniqueOrThrow({
      where: { email: credentials.email },
    });

    for (const response of [registered, loggedIn, refreshed]) {
      expect(response.status).toBeLessThan(300);
      const body = JSON.stringify(response.body);
      expect(body).not.toContain(TEST_PASSWORD);
      expect(body).not.toContain('passwordHash');
      expect(body).not.toContain('$argon2id$');
      expect(body).not.toContain(passwordHash);
      // Raw body, not the parsed one: parsing would strip an extra key and hide the leak.
      const rawUser = (response.body as { user: object }).user;
      expect(Object.keys(rawUser).sort()).toEqual(['createdAt', 'displayName', 'email', 'id']);
      expect(AuthResponseSchema.parse(response.body).user.email).toBe(credentials.email);
    }
  });
});
