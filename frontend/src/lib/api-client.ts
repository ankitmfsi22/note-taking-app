import { ErrorResponseSchema, type ErrorCode, type ErrorDetail } from '@note-app/shared';
import type { z } from 'zod';

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

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
};

// The only place that calls fetch. AB-1010 adds the Bearer token and the refresh-and-retry.
export const apiFetch = async <S extends z.ZodType>(
  path: string,
  schema: S,
  init: RequestInit = {},
): Promise<z.output<S>> => {
  let response: Response;
  try {
    // An absolute URL keeps relative paths working under jsdom and msw as well as in the browser.
    response = await fetch(new URL(`${API_BASE_PATH}${path}`, window.location.origin), init);
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server');
  }

  const body = await readJson(response);

  if (!response.ok) {
    const parsed = ErrorResponseSchema.safeParse(body);
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      throw new ApiError(response.status, code, message, details);
    }
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      'The server sent an unexpected error response',
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      'The server sent an unexpected response',
    );
  }
  return parsed.data;
};
