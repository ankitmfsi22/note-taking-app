import {
  AuthResponseSchema,
  ErrorResponseSchema,
  type AuthResponse,
  type ErrorCode,
  type ErrorDetail,
} from '@note-app/shared';
import type { z } from 'zod';
import { useAuthStore } from '@/features/auth/session-store';

export const API_BASE_PATH = '/api/v1';

export type ApiErrorCode = ErrorCode | 'NETWORK_ERROR' | 'INVALID_RESPONSE';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiRequestInit extends RequestInit {
  // false for the auth endpoints: no Bearer header and no refresh-and-retry (SDS 9.3).
  auth?: boolean;
}

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
};

const toApiError = (status: number, body: unknown): ApiError => {
  const parsed = ErrorResponseSchema.safeParse(body);
  if (parsed.success) {
    const { code, message, details } = parsed.data.error;
    return new ApiError(status, code, message, details);
  }
  return new ApiError(status, 'INVALID_RESPONSE', 'The server sent an unexpected error response');
};

// The only place that calls fetch.
const send = async (path: string, init: RequestInit, token: string | null) => {
  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  try {
    // An absolute URL keeps relative paths working under jsdom and msw as well as in the browser.
    return await fetch(new URL(`${API_BASE_PATH}${path}`, window.location.origin), {
      ...init,
      headers,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server');
  }
};

let refreshInFlight: Promise<AuthResponse> | null = null;

// Web Locks keep two tabs from rotating the same refresh cookie at once (SA-32); a reused
// rotated token would revoke every session of the user (AC-AUTH-12).
const exclusive = <T>(task: () => Promise<T>): Promise<T> =>
  'locks' in navigator ? navigator.locks.request('refresh', task) : task();

// One refresh at a time for every caller in this tab. A rejected refresh ends the session; a
// network failure does not, because the cookie may still be valid.
export const refreshSession = (): Promise<AuthResponse> => {
  refreshInFlight ??= exclusive(() =>
    apiFetch('/auth/refresh', AuthResponseSchema, { method: 'POST', auth: false }),
  )
    .then(
      (auth) => {
        useAuthStore.getState().setSession(auth);
        return auth;
      },
      (error: unknown) => {
        if (!(error instanceof ApiError) || error.code !== 'NETWORK_ERROR') {
          useAuthStore.getState().clearSession();
        }
        throw error;
      },
    )
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
};

const request = async (
  path: string,
  init: ApiRequestInit,
): Promise<{ status: number; body: unknown }> => {
  const { auth = true, ...rest } = init;
  const token = () => (auth ? useAuthStore.getState().accessToken : null);

  let response = await send(path, rest, token());
  let body = await readJson(response);

  if (auth && response.status === 401) {
    const error = toApiError(response.status, body);
    if (error.code !== 'UNAUTHORIZED') throw error;
    await refreshSession();
    response = await send(path, rest, token());
    body = await readJson(response);
  }

  if (!response.ok) throw toApiError(response.status, body);
  return { status: response.status, body };
};

export const apiFetch = async <S extends z.ZodType>(
  path: string,
  schema: S,
  init: ApiRequestInit = {},
): Promise<z.output<S>> => {
  const { status, body } = await request(path, init);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(status, 'INVALID_RESPONSE', 'The server sent an unexpected response');
  }
  return parsed.data;
};

// For endpoints that answer 204 with no body.
export const apiSend = async (path: string, init: ApiRequestInit = {}): Promise<void> => {
  await request(path, init);
};
