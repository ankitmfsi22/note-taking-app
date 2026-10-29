import { ErrorResponseSchema } from '@note-app/shared';
import express from 'express';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createErrorHandler, notFoundHandler } from '../errors/error-middleware.js';
import { createOriginCheck } from './origin-check.js';

const APP_ORIGIN = 'http://localhost:5173';

const buildApp = (appOrigin: string) => {
  const app = express();
  app.post('/checked', createOriginCheck(appOrigin), (_req, res) => {
    res.status(204).end();
  });
  app.use(notFoundHandler);
  app.use(createErrorHandler(pino({ level: 'silent' })));
  return app;
};

const post = (app: express.Express, origin?: string) => {
  const call = request(app).post('/checked');
  return origin === undefined ? call : call.set('Origin', origin);
};

describe('originCheck', () => {
  it('lets a request without an Origin header through', async () => {
    const response = await post(buildApp(APP_ORIGIN));

    expect(response.status).toBe(204);
  });

  it('lets a request through when Origin equals the configured origin', async () => {
    const response = await post(buildApp(APP_ORIGIN), APP_ORIGIN);

    expect(response.status).toBe(204);
  });

  it('refuses a foreign Origin with 403 FORBIDDEN_ORIGIN', async () => {
    const response = await post(buildApp(APP_ORIGIN), 'https://evil.example');

    expect(response.status).toBe(403);
    expect(ErrorResponseSchema.parse(response.body).error.code).toBe('FORBIDDEN_ORIGIN');
  });

  it('refuses the literal Origin "null"', async () => {
    const response = await post(buildApp(APP_ORIGIN), 'null');

    expect(response.status).toBe(403);
    expect(ErrorResponseSchema.parse(response.body).error.code).toBe('FORBIDDEN_ORIGIN');
  });

  it('compares origins, so a trailing slash on APP_ORIGIN still matches', async () => {
    const app = buildApp(`${APP_ORIGIN}/`);

    expect((await post(app, APP_ORIGIN)).status).toBe(204);
    expect((await post(app, 'https://evil.example')).status).toBe(403);
  });

  it.each([
    ['a different port', 'http://localhost:5174'],
    ['a different scheme', 'https://localhost:5173'],
    ['a different host', 'http://localhost.evil.example:5173'],
    ['a suffix of the allowed origin', `${APP_ORIGIN}.evil.example`],
  ])('refuses %s', async (_name, origin) => {
    const response = await post(buildApp(APP_ORIGIN), origin);

    expect(response.status).toBe(403);
  });
});
