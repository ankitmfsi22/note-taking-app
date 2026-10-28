import type { ErrorDetail } from '@note-app/shared';
import type { RequestHandler } from 'express';
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
