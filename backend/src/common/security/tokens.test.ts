import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { AppError } from '../errors/app-error.js';
import {
  generateOtp,
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from './tokens.js';

const SECRET = 'test-only-jwt-access-secret-at-least-32-bytes';
const USER_ID = '0192b7c4-5a1e-7c3a-9d2f-3b8e6f1a4c70';
const NOW = new Date('2026-10-28T12:00:00.000Z');
const NOW_SECONDS = NOW.getTime() / 1000;

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

const decodePayload = (token: string) =>
  JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >;

// Signs a token the way signAccessToken does, with one claim or header swapped out.
const forgeToken = async ({
  alg = 'HS256',
  secret = SECRET,
  issuer = 'note-app',
  audience = 'note-app-api',
}: {
  alg?: string;
  secret?: string;
  issuer?: string;
  audience?: string;
} = {}) =>
  new SignJWT({})
    .setProtectedHeader({ alg })
    .setSubject(USER_ID)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt(NOW_SECONDS)
    .setExpirationTime(NOW_SECONDS + 900)
    .sign(new TextEncoder().encode(secret));

const expectUnauthorized = async (promise: Promise<unknown>) => {
  const error = await promise.then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe('UNAUTHORIZED');
};

describe('access token', () => {
  it('carries sub, iss, aud, iat and an exp exactly 900 seconds later', async () => {
    const token = await signAccessToken({ userId: USER_ID, now: NOW, secret: SECRET });
    const payload = decodePayload(token);

    expect(payload['sub']).toBe(USER_ID);
    expect(payload['iss']).toBe('note-app');
    expect(payload['aud']).toBe('note-app-api');
    expect(payload['iat']).toBe(NOW_SECONDS);
    expect((payload['exp'] as number) - (payload['iat'] as number)).toBe(900);
  });

  it('verifies a token it signed and returns the user id', async () => {
    const token = await signAccessToken({ userId: USER_ID, now: NOW, secret: SECRET });

    await expect(verifyAccessToken(token, SECRET, NOW)).resolves.toEqual({ userId: USER_ID });
  });

  it('accepts the token just before expiry and rejects it once the clock passes 900 seconds', async () => {
    const token = await signAccessToken({ userId: USER_ID, now: NOW, secret: SECRET });
    const justBefore = new Date(NOW.getTime() + 899_000);
    const after = new Date(NOW.getTime() + 901_000);

    await expect(verifyAccessToken(token, SECRET, justBefore)).resolves.toEqual({
      userId: USER_ID,
    });
    await expectUnauthorized(verifyAccessToken(token, SECRET, after));
  });

  it('rejects an unsigned token with alg none', async () => {
    const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
      sub: USER_ID,
      iss: 'note-app',
      aud: 'note-app-api',
      iat: NOW_SECONDS,
      exp: NOW_SECONDS + 900,
    })}.`;

    await expectUnauthorized(verifyAccessToken(token, SECRET, NOW));
  });

  it('rejects a token signed with HS512', async () => {
    await expectUnauthorized(verifyAccessToken(await forgeToken({ alg: 'HS512' }), SECRET, NOW));
  });

  it('rejects a token signed with another secret', async () => {
    const token = await forgeToken({ secret: 'another-secret-that-is-also-32-bytes-long' });

    await expectUnauthorized(verifyAccessToken(token, SECRET, NOW));
  });

  it('rejects a token for another audience', async () => {
    await expectUnauthorized(
      verifyAccessToken(await forgeToken({ audience: 'someone-else' }), SECRET, NOW),
    );
  });

  it('rejects a token from another issuer', async () => {
    await expectUnauthorized(
      verifyAccessToken(await forgeToken({ issuer: 'someone-else' }), SECRET, NOW),
    );
  });

  it('rejects a correctly signed token that has no subject', async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('note-app')
      .setAudience('note-app-api')
      .setIssuedAt(NOW_SECONDS)
      .setExpirationTime(NOW_SECONDS + 900)
      .sign(new TextEncoder().encode(SECRET));

    await expectUnauthorized(verifyAccessToken(token, SECRET, NOW));
  });

  it('rejects a string that is not a token', async () => {
    await expectUnauthorized(verifyAccessToken('not-a-jwt', SECRET, NOW));
  });
});

describe('refresh token', () => {
  it('is 43 base64url characters (256 bits)', () => {
    expect(generateRefreshToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('is different on every call', () => {
    expect(generateRefreshToken()).not.toBe(generateRefreshToken());
  });

  it('hashes to 64 lowercase hex characters, the same way every time', () => {
    const token = generateRefreshToken();

    expect(hashRefreshToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
    expect(hashRefreshToken(token)).not.toBe(token);
  });
});

describe('generateOtp', () => {
  it('is always six digits', () => {
    for (let i = 0; i < 100; i += 1) expect(generateOtp()).toMatch(/^\d{6}$/);
  });

  it('zero-pads a value below 100000', () => {
    expect(generateOtp(() => 42)).toBe('000042');
  });

  it('draws from 0 up to but not including 1000000', () => {
    const calls: [number, number][] = [];
    generateOtp((min, max) => {
      calls.push([min, max]);
      return 999_999;
    });

    expect(calls).toEqual([[0, 1_000_000]]);
  });
});
