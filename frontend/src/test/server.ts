import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { errorBody } from './fixtures';

// Defaults: the API is up and the visitor has no session (the bootstrap refresh is rejected).
export const handlers = [
  http.get('*/api/v1/health', () => HttpResponse.json({ status: 'ok' })),
  http.post('*/api/v1/auth/refresh', () =>
    HttpResponse.json(errorBody('INVALID_REFRESH_TOKEN'), { status: 401 }),
  ),
];

export const server = setupServer(...handlers);
