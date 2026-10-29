import { ErrorResponseSchema } from '@note-app/shared';
import express from 'express';
import { SignJWT } from 'jose';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createMutableClock } from '../../../tests/support/test-app.js';
import { createErrorHandler, notFoundHandler } from '../errors/error-middleware.js';
import { signAccessToken } from '../security/tokens.js';
import { createRequireAuth } from './require-auth.js';

const SECRET = 'test-only-jwt-access-secret-at-least-32-bytes';
const USER_ID = '0192b7c4-5a1e-7c3a-9d2f-3b8e6f1a4c70';
const START = '2026-10-28T12:00:00.000Z';

const buildGuardedApp = () => {
  const clock = createMutableClock(START);
  const handler = vi.fn<express.RequestHandler>((_req, res) => {
    const userId: unknown = res.locals.userId;
    res.json({ userId });
  });
  const app = express();
  app.get('/guarded', createRequireAuth({ secret: SECRET, clock }), handler);
  app.use(notFoundHandler);
  app.use(createErrorHandler(pino({ level: 'silent' })));
  return { app, clock, handler };
};

// Signs a token the way signAccessToken does, with one claim, key or header swapped out.
const forgeToken = ({
  alg = 'HS256',
  secret = SECRET,
  issuer = 'note-app',
  audience = 'note-app-api',
}: {
  alg?: string;
  secret?: string;
  issuer?: string;
  audience?: string;
} = {}) => {
  const issuedAt = new Date(START).getTime() / 1000;
  return new SignJWT({})
    .setProtectedHeader({ alg })
    .setSubject(USER_ID)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 900)
    .sign(new TextEncoder().encode(secret));
};

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

const unsignedToken = () => {
  const issuedAt = new Date(START).getTime() / 1000;
  const payload = {
    sub: USER_ID,
    iss: 'note-app',
    aud: 'note-app-api',
    iat: issuedAt,
    exp: issuedAt + 900,
  };
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.`;
};

describe('requireAuth', () => {
  it('S-AB1002-29: a protected route without a token returns 401 UNAUTHORIZED', async () => {
    const { app, handler } = buildGuardedApp();
    const headers = [undefined, 'Basic abc', 'Bearer garbage'];

    for (const authorization of headers) {
      const call = request(app).get('/guarded');
      const response = await (authorization ? call.set('Authorization', authorization) : call);

      expect(response.status, `Authorization: ${authorization ?? '(none)'}`).toBe(401);
      expect(ErrorResponseSchema.parse(response.body).error.code).toBe('UNAUTHORIZED');
    }
    expect(handler).not.toHaveBeenCalled();
  });

  it('S-AB1002-30: expired, wrongly signed and wrong-claim tokens return 401 UNAUTHORIZED', async () => {
    const { app, clock, handler } = buildGuardedApp();
    const expired = await signAccessToken({ userId: USER_ID, now: clock.now(), secret: SECRET });
    clock.advanceMs(901_000);

    const tokens = {
      expired,
      'another secret': await forgeToken({ secret: 'another-secret-that-is-also-32-bytes-long' }),
      'alg none': unsignedToken(),
      HS512: await forgeToken({ alg: 'HS512' }),
      'audience other': await forgeToken({ audience: 'other' }),
      'issuer other': await forgeToken({ issuer: 'other' }),
    };

    for (const [name, token] of Object.entries(tokens)) {
      const response = await request(app).get('/guarded').set('Authorization', `Bearer ${token}`);

      expect(response.status, name).toBe(401);
      expect(ErrorResponseSchema.parse(response.body).error.code, name).toBe('UNAUTHORIZED');
    }
    expect(handler).not.toHaveBeenCalled();
  });

  it('puts the user id in res.locals and calls the handler for a valid token', async () => {
    const { app, clock, handler } = buildGuardedApp();
    const token = await signAccessToken({ userId: USER_ID, now: clock.now(), secret: SECRET });

    const response = await request(app).get('/guarded').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ userId: USER_ID });
    expect(handler).toHaveBeenCalledOnce();
  });

  it('requires the exact Bearer scheme: lowercase, extra spaces and a bare token are refused', async () => {
    const { app, clock, handler } = buildGuardedApp();
    const token = await signAccessToken({ userId: USER_ID, now: clock.now(), secret: SECRET });

    for (const header of [`bearer ${token}`, `Bearer  ${token}`, token]) {
      const response = await request(app).get('/guarded').set('Authorization', header);

      expect(response.status).toBe(401);
    }
    expect(handler).not.toHaveBeenCalled();
  });
});
