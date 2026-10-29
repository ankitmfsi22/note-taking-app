import type { RequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';

// CSRF defence for the cookie-authenticated routes (SA-05). SameSite=Strict is the first line;
// this refuses a request that names another origin. A request with no Origin header (non-browser
// clients, Supertest) passes, and the literal "null" is a present, non-matching value, so it is refused.
export const createOriginCheck = (appOrigin: string): RequestHandler => {
  const allowed = new URL(appOrigin).origin;
  return (req, _res, next) => {
    const origin = req.headers.origin;
    if (origin !== undefined && origin !== allowed) {
      throw new AppError('FORBIDDEN_ORIGIN', 'Origin not allowed');
    }
    next();
  };
};
