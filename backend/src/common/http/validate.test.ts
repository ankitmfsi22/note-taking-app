import { ErrorResponseSchema } from '@note-app/shared';
import express, { type Express } from 'express';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createErrorHandler, notFoundHandler } from '../errors/error-middleware.js';
import { validate, validBody } from './validate.js';

const buildApp = (setup: (app: Express) => void) => {
  const app = express();
  app.use(express.json());
  setup(app);
  app.use(notFoundHandler);
  app.use(createErrorHandler(pino({ level: 'silent' })));
  return app;
};

const echoValid: express.RequestHandler = (_req, res) => {
  res.json(res.locals.valid);
};

describe('validate', () => {
  it('stores parsed body, query and params in res.locals.valid', async () => {
    const app = buildApp((a) =>
      a.post(
        '/items/:id',
        validate({
          params: z.object({ id: z.uuid() }),
          query: z.object({ page: z.coerce.number().int().min(1) }),
          body: z.object({ title: z.string().trim().min(1) }),
        }),
        echoValid,
      ),
    );
    const id = '0192f3f0-7b1e-7a3c-9d2e-3c5f1a2b4d6e';
    const response = await request(app)
      .post(`/items/${id}?page=2`)
      .send({ title: '  hello  ' })
      .expect(200);
    expect(response.body).toEqual({ params: { id }, query: { page: 2 }, body: { title: 'hello' } });
  });

  it('S-AB1001-06: returns 400 VALIDATION_ERROR with a dotted field path per issue', async () => {
    const app = buildApp((a) =>
      a.post(
        '/x',
        validate({ body: z.object({ user: z.object({ email: z.email() }), age: z.number() }) }),
        echoValid,
      ),
    );
    const response = await request(app)
      .post('/x')
      .send({ user: { email: 'nope' }, age: 'x' })
      .expect(400);
    const error = ErrorResponseSchema.parse(response.body).error;
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details?.map((detail) => detail.field).sort()).toEqual(['age', 'user.email']);
  });

  it('collects issues from query and params as well as the body', async () => {
    const app = buildApp((a) =>
      a.post(
        '/items/:id',
        validate({
          params: z.object({ id: z.uuid() }),
          query: z.object({ page: z.coerce.number().min(1) }),
          body: z.object({ title: z.string() }),
        }),
        echoValid,
      ),
    );
    const response = await request(app).post('/items/not-a-uuid?page=0').send({}).expect(400);
    const fields = ErrorResponseSchema.parse(response.body).error.details?.map((d) => d.field);
    expect(fields?.sort()).toEqual(['id', 'page', 'title']);
  });

  it('names the part when the whole value is wrong (for example a missing body)', async () => {
    const app = buildApp((a) =>
      a.post('/x', validate({ body: z.object({ title: z.string() }) }), echoValid),
    );
    const response = await request(app).post('/x').expect(400);
    const details = ErrorResponseSchema.parse(response.body).error.details;
    expect(details?.[0]?.field).toBe('body');
  });

  it('skips parts that have no schema', async () => {
    const app = buildApp((a) => a.get('/x', validate({}), echoValid));
    const response = await request(app).get('/x').expect(200);
    expect(response.body).toEqual({});
  });
});

describe('validBody', () => {
  it('returns the parsed body that validate() stored, with the type the caller names', async () => {
    const app = buildApp((a) =>
      a.post('/x', validate({ body: z.object({ title: z.string().trim() }) }), (_req, res) => {
        const body = validBody<{ title: string }>(res);
        res.json({ shout: body.title.toUpperCase() });
      }),
    );
    const response = await request(app).post('/x').send({ title: '  hi  ' }).expect(200);
    expect(response.body).toEqual({ shout: 'HI' });
  });

  it('is a server error, not a client error, when validate() did not run for the body', async () => {
    const app = buildApp((a) =>
      a.post('/x', validate({}), (_req, res) => {
        res.json(validBody<{ title: string }>(res));
      }),
    );
    const response = await request(app).post('/x').send({}).expect(500);
    expect(ErrorResponseSchema.parse(response.body).error.code).toBe('INTERNAL_ERROR');
  });
});
