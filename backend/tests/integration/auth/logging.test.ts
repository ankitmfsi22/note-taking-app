import { AuthResponseSchema } from '@note-app/shared';
import request, { type Response } from 'supertest';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../support/db.js';
import { createTestApp, refreshCookieOf, registerUser } from '../../support/test-app.js';

const prisma = useTestDatabase();

const setCookieHeadersOf = (response: Response): string[] => {
  const header: unknown = response.headers['set-cookie'];
  return Array.isArray(header) ? header.map(String) : [];
};

describe('request logging', () => {
  it('S-AB1002-11: passwords and tokens are not logged', async () => {
    const { app, logs } = createTestApp({ prisma });
    const { response: registered, credentials } = await registerUser(app);
    const loggedIn = await request(app).post('/api/v1/auth/login').send(credentials);
    const registeredCookie = refreshCookieOf(registered) ?? '';
    const accessToken = AuthResponseSchema.parse(registered.body).accessToken;
    // The bearer header is not read by these routes; it is sent so the redaction of it is exercised.
    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', registeredCookie)
      .set('Authorization', `Bearer ${accessToken}`);
    const refreshedCookie = refreshCookieOf(refreshed) ?? '';
    const loggedOut = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', refreshedCookie)
      .set('Authorization', `Bearer ${accessToken}`);

    const responses = [registered, loggedIn, refreshed, loggedOut];
    const cookiePairs = [registeredCookie, refreshCookieOf(loggedIn) ?? '', refreshedCookie];
    const secrets = [
      credentials.password,
      ...[registered, loggedIn, refreshed].map(
        (response) => AuthResponseSchema.parse(response.body).accessToken,
      ),
      ...cookiePairs,
      ...cookiePairs.map((pair) => pair.replace('refresh_token=', '')),
      ...responses.flatMap(setCookieHeadersOf),
    ];

    const text = logs.text();
    // A log that is empty or missing a request would pass vacuously.
    for (const path of ['register', 'login', 'refresh', 'logout']) {
      expect(text, `log line for ${path}`).toContain(`/api/v1/auth/${path}`);
    }
    for (const secret of secrets) {
      expect(secret).not.toBe('');
      expect(text, 'a secret value appears in the log').not.toContain(secret);
    }
  });
});
