import { REFRESH_TOKEN_TTL_DAYS } from '@note-app/shared';
import type { CookieOptions, Response } from 'express';

export const REFRESH_COOKIE_NAME = 'refresh_token';

const REFRESH_COOKIE_MAX_AGE_MS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

// One builder for setting and clearing: a browser only replaces a cookie whose attributes match.
const cookieOptions = (secure: boolean): CookieOptions => ({
  httpOnly: true,
  secure,
  sameSite: 'strict',
  path: '/api/v1/auth',
});

export const setRefreshCookie = (res: Response, token: string, secure: boolean): void => {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...cookieOptions(secure),
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  });
};

// Not res.clearCookie: it drops maxAge and sends only Expires, but SDS 5.3 requires Max-Age=0.
export const clearRefreshCookie = (res: Response, secure: boolean): void => {
  res.cookie(REFRESH_COOKIE_NAME, '', { ...cookieOptions(secure), maxAge: 0 });
};
