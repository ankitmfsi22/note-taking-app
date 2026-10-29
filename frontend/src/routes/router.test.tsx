import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { createTestQueryClient } from '@/test/render';
import { createRouter, routes } from './router';

// The first lazy import is transformed cold and can take over the 1 s default on Windows.
const LOAD = { timeout: 5000 };

const renderRoute = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
};

describe('routes', () => {
  it('createRouter builds a browser router from the route table', () => {
    const router = createRouter();
    expect(router.routes[0]?.children?.map((route) => route.path ?? route.id)).toEqual([
      '/',
      'guest-only',
      'require-auth',
      '*',
    ]);
    router.dispose();
  });

  it('S-AB1001-31: shows a loading fallback while the first lazy route loads', async () => {
    renderRoute('/');
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Note App' }, LOAD)).toBeInTheDocument();
  });

  it('sends a guest from / to the login page, which shows the API status', async () => {
    const router = renderRoute('/');
    expect(await screen.findByRole('heading', { name: 'Sign in' }, LOAD)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(await screen.findByText('The API is up.')).toBeInTheDocument();
  });

  it('renders the not-found page for an unknown path, with a link back', async () => {
    renderRoute('/does-not-exist');
    expect(
      await screen.findByRole('heading', { name: 'Page not found' }, LOAD),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the start' })).toHaveAttribute('href', '/');
  });
});
