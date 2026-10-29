import type { Response } from 'supertest';
import { hashRefreshToken } from '../../src/common/security/tokens.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';

// A cleared cookie has an empty value and Max-Age=0 (SDS 5.3).
export const clearsCookie = (response: Response): boolean => {
  const header: unknown = response.headers['set-cookie'];
  const cookies = Array.isArray(header) ? header.map(String) : [];
  const cleared = cookies.find((cookie) => cookie.startsWith('refresh_token=;'));
  return cleared !== undefined && cleared.includes('Max-Age=0');
};

// The stored row for a `refresh_token=<value>` pair, found the way the server finds it: by hash.
export const refreshTokenRowOf = (prisma: PrismaClient, cookiePair: string) =>
  prisma.refreshToken.findUniqueOrThrow({
    where: { tokenHash: hashRefreshToken(cookiePair.replace('refresh_token=', '')) },
  });
