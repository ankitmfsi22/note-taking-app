import { ErrorResponseSchema } from '@note-app/shared';
import express, { type Express, type Request, type Response } from 'express';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createLogCapture } from '../../../tests/support/test-app.js';
import { createRequestLogger } from '../http/request-logging.js';
import { AppError } from './app-error.js';
import { createErrorHandler, notFoundHandler } from './error-middleware.js';

const buildApp = (setup: (app: Express) => void) => {
  const logs = createLogCapture();
  const logger = pino({ level: 'info' }, logs.stream);
  const app = express();
  app.use(createRequestLogger(logger));
  app.use(express.json({ limit: '1kb' }));
  setup(app);
  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));
  return { app, logs };
};

describe('error middleware', () => {
  it('maps an AppError to its status, code, message and request id', async () => {
    const { app } = buildApp((a) =>
      a.get('/x', () => {
        throw new AppError('NOTE_NOT_FOUND', 'Note not found');
      }),
    );
    const response = await request(app).get('/x').expect(404);
    expect(ErrorResponseSchema.parse(response.body)).toEqual({
      error: {
        code: 'NOTE_NOT_FOUND',
        message: 'Note not found',
        requestId: response.headers['x-request-id'],
      },
    });
  });

  it('includes details when the AppError has them', async () => {
    const details = [{ field: 'email', message: 'Invalid email' }];
    const { app } = buildApp((a) =>
      a.get('/x', () => {
        throw new AppError('VALIDATION_ERROR', 'Request validation failed', details);
      }),
    );
    const response = await request(app).get('/x').expect(400);
    expect(ErrorResponseSchema.parse(response.body).error.details).toEqual(details);
  });

  it('forwards a rejected async handler to the error handler (Express 5)', async () => {
    const { app } = buildApp((a) =>
      a.get('/x', async () => {
        await Promise.resolve();
        throw new AppError('TAG_NOT_FOUND', 'Tag not found');
      }),
    );
    const response = await request(app).get('/x').expect(404);
    expect(ErrorResponseSchema.parse(response.body).error.code).toBe('TAG_NOT_FOUND');
  });

  it('turns an unknown error into 500 INTERNAL_ERROR without leaking details, and logs it', async () => {
    const { app, logs } = buildApp((a) =>
      a.get('/x', () => {
        throw new Error('connection to db failed: password=hunter2');
      }),
    );
    const response = await request(app).get('/x').expect(500);
    const body = ErrorResponseSchema.parse(response.body);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('Internal server error');
    expect(JSON.stringify(response.body)).not.toContain('hunter2');
    expect(logs.text()).toContain('unhandled error');
    expect(logs.text()).toContain('hunter2');
  });

  it('treats a stray ZodError as a server bug (500), not as a client validation error', async () => {
    const { app } = buildApp((a) =>
      a.get('/x', () => {
        z.object({ id: z.string() }).parse({});
      }),
    );
    const response = await request(app).get('/x').expect(500);
    expect(ErrorResponseSchema.parse(response.body).error.code).toBe('INTERNAL_ERROR');
  });

  it('maps unparseable JSON to 400 MALFORMED_JSON', async () => {
    const { app } = buildApp((a) => a.post('/x', (_req, res) => res.json({})));
    const response = await request(app)
      .post('/x')
      .set('Content-Type', 'application/json')
      .send('{"broken":')
      .expect(400);
    expect(ErrorResponseSchema.parse(response.body).error.code).toBe('MALFORMED_JSON');
  });

  it('maps a body over the limit to 413 PAYLOAD_TOO_LARGE', async () => {
    const { app } = buildApp((a) => a.post('/x', (_req, res) => res.json({})));
    const response = await request(app)
      .post('/x')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ text: 'a'.repeat(2048) }))
      .expect(413);
    expect(ErrorResponseSchema.parse(response.body).error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('maps an unknown route to 404 ROUTE_NOT_FOUND', async () => {
    const { app } = buildApp(() => undefined);
    const response = await request(app).get('/missing').expect(404);
    expect(ErrorResponseSchema.parse(response.body).error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('uses "unknown" as request id when no request logger is mounted', async () => {
    const logger = pino({ level: 'silent' });
    const app = express();
    app.use(notFoundHandler);
    app.use(createErrorHandler(logger));
    const response = await request(app).get('/x').expect(404);
    expect(ErrorResponseSchema.parse(response.body).error.requestId).toBe('unknown');
  });

  it('hands the error to Express when the response has already started', () => {
    const handler = createErrorHandler(pino({ level: 'silent' }));
    const error = new Error('late failure');
    const next = vi.fn();
    const status = vi.fn();
    const res = { headersSent: true, status } as unknown as Response;
    handler(error, {} as Request, res, next);
    expect(next).toHaveBeenCalledWith(error);
    expect(status).not.toHaveBeenCalled();
  });
});
