import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { createTestQueryClient } from '@/test/render';
import { createRouter, routes } from './router';

const renderRoute = (path: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
};

describe('routes', () => {
  it('createRouter builds a browser router from the route table', () => {
    const router = createRouter();
    expect(router.routes[0]?.children?.map((route) => route.path)).toEqual(['/', '*']);
    router.dispose();
  });

  it('shows a loading fallback while the first lazy route loads', async () => {
    renderRoute('/');
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Note App' })).toBeInTheDocument();
  });

  it('renders the home page at / with the API status', async () => {
    renderRoute('/');
    expect(await screen.findByRole('heading', { name: 'Note App' })).toBeInTheDocument();
    expect(await screen.findByText('The API is up.')).toBeInTheDocument();
  });

  it('renders the not-found page for an unknown path, with a link back', async () => {
    renderRoute('/does-not-exist');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the start' })).toHaveAttribute('href', '/');
  });
});
