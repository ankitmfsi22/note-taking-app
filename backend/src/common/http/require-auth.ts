import type { RequestHandler } from 'express';
import type { Clock } from '../clock.js';
import { AppError } from '../errors/app-error.js';
import { verifyAccessToken } from '../security/tokens.js';

const BEARER_PREFIX = 'Bearer ';

interface RequireAuthDeps {
  secret: string;
  clock: Clock;
}

// Sets res.locals.userId from a valid access token. Every failure is the same 401, so the response
// does not say whether the token was missing, malformed, expired or forged.
export const createRequireAuth =
  ({ secret, clock }: RequireAuthDeps): RequestHandler =>
  async (req, res, next) => {
    const header = req.headers.authorization;
    const token = header?.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length) : '';
    if (token === '' || token.startsWith(' ')) {
      throw new AppError('UNAUTHORIZED', 'Authentication required');
    }
    const { userId } = await verifyAccessToken(token, secret, clock.now());
    res.locals.userId = userId;
    next();
  };
