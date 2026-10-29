import { AuthResponseSchema } from '@note-app/shared';
import express from 'express';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createErrorHandler } from '../../../src/common/errors/error-middleware.js';
import { createRequireAuth } from '../../../src/common/http/require-auth.js';
import { useTestDatabase } from '../../support/db.js';
import { createMutableClock, createTestApp, registerUser } from '../../support/test-app.js';

const prisma = useTestDatabase();

describe('requireAuth with a token from the real login', () => {
  it('S-AB1002-31: a valid access token reaches the handler with the user ID', async () => {
    const clock = createMutableClock('2026-10-28T12:00:00.000Z');
    const { app, env } = createTestApp({ prisma, clock });
    const { credentials } = await registerUser(app);
    const login = await request(app).post('/api/v1/auth/login').send(credentials);
    const { accessToken, user } = AuthResponseSchema.parse(login.body);

    // The guarded route lives only here, so nothing in app.ts exists just for the test.
    const guarded = express();
    guarded.get(
      '/guarded',
      createRequireAuth({ secret: env.JWT_ACCESS_SECRET, clock }),
      (_req, res) => {
        const userId: unknown = res.locals.userId;
        res.json({ userId });
      },
    );
    guarded.use(createErrorHandler(pino({ level: 'silent' })));

    const response = await request(guarded)
      .get('/guarded')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ userId: user.id });
    // A guard that let everything through would also answer 200 above.
    expect((await request(guarded).get('/guarded')).status).toBe(401);
  });
});
