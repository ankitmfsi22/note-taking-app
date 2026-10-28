import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { server } from '@/test/server';
import { ApiError, apiFetch } from './api-client';

const ThingSchema = z.object({ name: z.string() });

const failure = async (promise: Promise<unknown>): Promise<ApiError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected apiFetch to reject');
};

describe('apiFetch', () => {
  it('returns the body parsed with the given schema', async () => {
    server.use(http.get('*/api/v1/things', () => HttpResponse.json({ name: 'a', extra: 1 })));
    await expect(apiFetch('/things', ThingSchema)).resolves.toEqual({ name: 'a' });
  });

  it('requests an absolute URL under /api/v1 on the current origin', async () => {
    let requested = '';
    server.use(
      http.get('*/api/v1/things', ({ request }) => {
        requested = request.url;
        return HttpResponse.json({ name: 'a' });
      }),
    );
    await apiFetch('/things', ThingSchema);
    expect(requested).toBe(`${window.location.origin}/api/v1/things`);
  });

  it('passes the request init through', async () => {
    let received: unknown;
    server.use(
      http.post('*/api/v1/things', async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ name: 'created' }, { status: 201 });
      }),
    );
    const result = await apiFetch('/things', ThingSchema, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'x' }),
    });
    expect(received).toEqual({ name: 'x' });
    expect(result).toEqual({ name: 'created' });
  });

  it('turns an error body into an ApiError with status, code, message and details', async () => {
    const details = [{ field: 'email', message: 'Invalid email' }];
    server.use(
      http.get('*/api/v1/things', () =>
        HttpResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Bad input', details, requestId: 'r1' } },
          { status: 400 },
        ),
      ),
    );
    const error = await failure(apiFetch('/things', ThingSchema));
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Bad input',
      details,
    });
  });

  it('reports INVALID_RESPONSE when an error response is not in the standard shape', async () => {
    server.use(
      http.get(
        '*/api/v1/things',
        () => new HttpResponse('<html>Bad gateway</html>', { status: 502 }),
      ),
    );
    const error = await failure(apiFetch('/things', ThingSchema));
    expect(error).toMatchObject({ status: 502, code: 'INVALID_RESPONSE' });
  });

  it('reports INVALID_RESPONSE when a success body fails the schema', async () => {
    server.use(http.get('*/api/v1/things', () => HttpResponse.json({ wrong: true })));
    const error = await failure(apiFetch('/things', ThingSchema));
    expect(error).toMatchObject({ status: 200, code: 'INVALID_RESPONSE' });
  });

  it('reports INVALID_RESPONSE when a success body is not JSON', async () => {
    server.use(http.get('*/api/v1/things', () => new HttpResponse('plain text')));
    const error = await failure(apiFetch('/things', ThingSchema));
    expect(error.code).toBe('INVALID_RESPONSE');
  });

  it('reports NETWORK_ERROR with status 0 when the request cannot be made', async () => {
    server.use(http.get('*/api/v1/things', () => HttpResponse.error()));
    const error = await failure(apiFetch('/things', ThingSchema));
    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });
});
