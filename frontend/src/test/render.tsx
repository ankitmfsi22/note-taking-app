import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/routes/router';
import { authResponse } from './fixtures';
import { server } from './server';

export const createTestQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

export const renderWithQuery = (ui: ReactElement) =>
  render(<QueryClientProvider client={createTestQueryClient()}>{ui}</QueryClientProvider>);

// The bootstrap refresh succeeds, so the app starts signed in.
export const signInViaRefresh = () =>
  server.use(http.post('*/api/v1/auth/refresh', () => HttpResponse.json(authResponse('boot'))));

// Renders the real routes (guards, shell, lazy pages) at a URL.
export const renderRoute = (path: string) => {
  const queryClient = createTestQueryClient();
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { queryClient, router };
};
