import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';

export const handlers = [http.get('*/api/v1/health', () => HttpResponse.json({ status: 'ok' }))];

export const server = setupServer(...handlers);
