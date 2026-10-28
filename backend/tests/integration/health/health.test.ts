import { ErrorResponseSchema, HealthResponseSchema } from '@note-app/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTestApp } from '../../support/test-app.js';

describe('GET /api/v1/health', () => {
  it('S-AB1001-01: returns 200 with the shared HealthResponse shape', async () => {
    const { app } = createTestApp();
    const response = await request(app).get('/api/v1/health').expect(200);
    expect(HealthResponseSchema.parse(response.body)).toEqual({ status: 'ok' });
    expect(response.headers['content-type']).toMatch(/application\/json/);
  });

  it('works without any authentication', async () => {
    const { app } = createTestApp();
    await request(app).get('/api/v1/health').expect(200);
  });

  it('sets security headers and hides X-Powered-By', async () => {
    const { app } = createTestApp();
    const response = await request(app).get('/api/v1/health');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});

describe('request id', () => {
  it('generates an X-Request-Id when the client sends none', async () => {
    const { app } = createTestApp();
    const response = await request(app).get('/api/v1/health');
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('keeps a well-formed X-Request-Id sent by the client', async () => {
    const { app } = createTestApp();
    const response = await request(app).get('/api/v1/health').set('X-Request-Id', 'trace-123');
    expect(response.headers['x-request-id']).toBe('trace-123');
  });

  it('replaces a malformed X-Request-Id', async () => {
    const { app } = createTestApp();
    const response = await request(app).get('/api/v1/health').set('X-Request-Id', 'bad id!');
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('unknown routes', () => {
  it('S-AB1001-02: returns 404 ROUTE_NOT_FOUND in the standard error shape with the request id', async () => {
    const { app } = createTestApp();
    const response = await request(app).get('/api/v1/nope').expect(404);
    const body = ErrorResponseSchema.parse(response.body);
    expect(body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(body.error.requestId).toBe(response.headers['x-request-id']);
  });

  it('returns 404 for a method the route does not define', async () => {
    const { app } = createTestApp();
    const response = await request(app).post('/api/v1/health').expect(404);
    expect(ErrorResponseSchema.parse(response.body).error.code).toBe('ROUTE_NOT_FOUND');
  });
});

describe('logging', () => {
  it('S-AB1001-08: logs the request without the Authorization header value', async () => {
    const { app, logs } = createTestApp();
    await request(app).get('/api/v1/health').set('Authorization', 'Bearer super-secret-token');
    expect(logs.text()).toContain('"url":"/api/v1/health"');
    expect(logs.text()).not.toContain('super-secret-token');
  });

  it('logs the request without the Cookie header value', async () => {
    const { app, logs } = createTestApp();
    await request(app).get('/api/v1/health').set('Cookie', 'refresh_token=secret-cookie-value');
    expect(logs.text()).not.toContain('secret-cookie-value');
  });
});
