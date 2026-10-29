import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { useAuthStore } from '@/features/auth/session-store';
import { authResponse, errorBody } from '@/test/fixtures';
import { server } from '@/test/server';
import { ApiError, apiFetch, apiSend, refreshSession } from './api-client';

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

const unauthorized = () => HttpResponse.json(errorBody('UNAUTHORIZED'), { status: 401 });

const signIn = (token = 'old-token') => useAuthStore.getState().setSession(authResponse(token));

describe('apiFetch with a session', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('S-AB1010-05: an expired access token is renewed once, or the session ends', async () => {
    // Part 1: two protected calls get 401 at the same time; one refresh serves both retries.
    signIn('old-token');
    let refreshCalls = 0;
    const seenTokens: (string | null)[] = [];
    server.use(
      http.post('*/api/v1/auth/refresh', () => {
        refreshCalls += 1;
        return HttpResponse.json(authResponse('new-token'));
      }),
      http.get('*/api/v1/things', ({ request }) => {
        const header = request.headers.get('authorization');
        seenTokens.push(header);
        return header === 'Bearer new-token' ? HttpResponse.json({ name: 'ok' }) : unauthorized();
      }),
    );
    const results = await Promise.all([
      apiFetch('/things', ThingSchema),
      apiFetch('/things', ThingSchema),
    ]);
    expect(results).toEqual([{ name: 'ok' }, { name: 'ok' }]);
    expect(refreshCalls).toBe(1);
    expect(seenTokens.filter((t) => t === 'Bearer new-token')).toHaveLength(2);
    expect(useAuthStore.getState().accessToken).toBe('new-token');

    // Part 2: the refresh itself is rejected, so the session is cleared and the call fails.
    server.use(
      http.post('*/api/v1/auth/refresh', () =>
        HttpResponse.json(errorBody('INVALID_REFRESH_TOKEN'), { status: 401 }),
      ),
      http.get('*/api/v1/things', unauthorized),
    );
    const error = await failure(apiFetch('/things', ThingSchema));
    expect(error.code).toBe('INVALID_REFRESH_TOKEN');
    expect(useAuthStore.getState()).toMatchObject({
      status: 'guest',
      user: null,
      accessToken: null,
    });

    // Part 3: an auth endpoint's own 401 never triggers a refresh.
    signIn('token-3');
    refreshCalls = 0;
    server.use(
      http.post('*/api/v1/auth/refresh', () => {
        refreshCalls += 1;
        return HttpResponse.json(authResponse());
      }),
      http.post('*/api/v1/auth/login', () =>
        HttpResponse.json(errorBody('INVALID_CREDENTIALS'), { status: 401 }),
      ),
    );
    const loginError = await failure(
      apiFetch('/auth/login', ThingSchema, { method: 'POST', auth: false }),
    );
    expect(loginError.code).toBe('INVALID_CREDENTIALS');
    expect(refreshCalls).toBe(0);
  });

  it('sends the access token as a Bearer header, and none for auth endpoints', async () => {
    signIn('abc');
    const headers: (string | null)[] = [];
    server.use(
      http.get('*/api/v1/things', ({ request }) => {
        headers.push(request.headers.get('authorization'));
        return HttpResponse.json({ name: 'a' });
      }),
    );
    await apiFetch('/things', ThingSchema);
    await apiFetch('/things', ThingSchema, { auth: false });
    expect(headers).toEqual(['Bearer abc', null]);
  });

  it('does not refresh on a 401 whose code is not UNAUTHORIZED', async () => {
    signIn();
    let refreshCalls = 0;
    server.use(
      http.post('*/api/v1/auth/refresh', () => {
        refreshCalls += 1;
        return HttpResponse.json(authResponse());
      }),
      http.get('*/api/v1/things', () =>
        HttpResponse.json(errorBody('INVALID_CREDENTIALS'), { status: 401 }),
      ),
    );
    const error = await failure(apiFetch('/things', ThingSchema));
    expect(error.code).toBe('INVALID_CREDENTIALS');
    expect(refreshCalls).toBe(0);
  });

  it('retries only once: a second 401 after the refresh is returned to the caller', async () => {
    signIn();
    server.use(
      http.post('*/api/v1/auth/refresh', () => HttpResponse.json(authResponse('new'))),
      http.get('*/api/v1/things', unauthorized),
    );
    const error = await failure(apiFetch('/things', ThingSchema));
    expect(error).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
  });

  it('keeps the session when the refresh fails on the network', async () => {
    signIn('kept');
    server.use(http.post('*/api/v1/auth/refresh', () => HttpResponse.error()));
    const error = await failure(refreshSession());
    expect(error.code).toBe('NETWORK_ERROR');
    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', accessToken: 'kept' });
  });

  it('runs the refresh inside a Web Lock when the browser has one', async () => {
    const request = vi.fn((_name: string, callback: () => Promise<unknown>) => callback());
    vi.stubGlobal('navigator', { ...navigator, locks: { request } });
    server.use(http.post('*/api/v1/auth/refresh', () => HttpResponse.json(authResponse('locked'))));
    await refreshSession();
    expect(request).toHaveBeenCalledWith('refresh', expect.any(Function));
    expect(useAuthStore.getState().accessToken).toBe('locked');
  });
});

describe('apiSend', () => {
  it('resolves for an empty 204 response and rejects with an ApiError on failure', async () => {
    server.use(http.post('*/api/v1/auth/logout', () => new HttpResponse(null, { status: 204 })));
    await expect(apiSend('/auth/logout', { method: 'POST', auth: false })).resolves.toBeUndefined();

    server.use(
      http.post('*/api/v1/auth/logout', () =>
        HttpResponse.json(errorBody('FORBIDDEN_ORIGIN'), { status: 403 }),
      ),
    );
    const error = await failure(apiSend('/auth/logout', { method: 'POST', auth: false }));
    expect(error).toMatchObject({ status: 403, code: 'FORBIDDEN_ORIGIN' });
  });
});
