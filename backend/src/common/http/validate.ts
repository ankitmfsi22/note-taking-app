import type { ErrorDetail } from '@note-app/shared';
import type { RequestHandler, Response } from 'express';
import type { z } from 'zod';
import { AppError } from '../errors/app-error.js';

interface RequestSchemas {
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
}

// Express 5 makes req.query a read-only getter, so parsed values go to res.locals.valid.
export const validate =
  (schemas: RequestSchemas): RequestHandler =>
  (req, res, next) => {
    const valid: Record<string, unknown> = {};
    const details: ErrorDetail[] = [];

    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part]);
      if (result.success) {
        valid[part] = result.data;
        continue;
      }
      for (const issue of result.error.issues) {
        const field = issue.path.length > 0 ? issue.path.map(String).join('.') : part;
        details.push({ field, message: issue.message });
      }
    }

    if (details.length > 0) {
      throw new AppError('VALIDATION_ERROR', 'Request validation failed', details);
    }
    res.locals.valid = valid;
    next();
  };

// The caller names the type (from packages/shared) because the backend cannot import zod at runtime
// to infer it. Reaching this without validate({ body }) is a wiring bug, so it is a plain Error (500).
const validPart = <T>(res: Response, part: keyof RequestSchemas): T => {
  const valid: unknown = res.locals.valid;
  if (typeof valid !== 'object' || valid === null || !(part in valid)) {
    throw new Error(`valid ${part} read on a route without validate({ ${part} })`);
  }
  return (valid as Record<string, unknown>)[part] as T;
};

export const validBody = <T>(res: Response): T => validPart<T>(res, 'body');
export const validParams = <T>(res: Response): T => validPart<T>(res, 'params');
export const validQuery = <T>(res: Response): T => validPart<T>(res, 'query');
