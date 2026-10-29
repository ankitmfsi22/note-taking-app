import { createHash, randomBytes, randomInt } from 'node:crypto';
import { ACCESS_TOKEN_TTL_SECONDS, OTP_LENGTH } from '@note-app/shared';
import { jwtVerify, SignJWT } from 'jose';
import { AppError } from '../errors/app-error.js';

const ISSUER = 'note-app';
const AUDIENCE = 'note-app-api';

const keyOf = (secret: string): Uint8Array => new TextEncoder().encode(secret);

interface SignAccessTokenInput {
  userId: string;
  now: Date;
  secret: string;
}

// iat and exp are set from the injected clock, so exp - iat is exactly the TTL and tests can move time.
export const signAccessToken = ({ userId, now, secret }: SignAccessTokenInput): Promise<string> => {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + ACCESS_TOKEN_TTL_SECONDS)
    .sign(keyOf(secret));
};

export const verifyAccessToken = async (
  token: string,
  secret: string,
  now: Date,
): Promise<{ userId: string }> => {
  try {
    const { payload } = await jwtVerify(token, keyOf(secret), {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
      currentDate: now,
    });
    if (typeof payload.sub !== 'string') throw new Error('missing subject');
    return { userId: payload.sub };
  } catch {
    throw new AppError('UNAUTHORIZED', 'Authentication required');
  }
};

export const generateRefreshToken = (): string => randomBytes(32).toString('base64url');

// Only this hash is stored, so a database leak does not yield usable refresh tokens.
export const hashRefreshToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

// randomInt has no modulo bias; the parameter lets a test force a value that needs padding.
export const generateOtp = (random: (min: number, max: number) => number = randomInt): string =>
  random(0, 10 ** OTP_LENGTH)
    .toString()
    .padStart(OTP_LENGTH, '0');
