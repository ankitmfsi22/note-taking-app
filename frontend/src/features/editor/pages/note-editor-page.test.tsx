import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeAll, describe, expect, it } from 'vitest';
import { routes } from '@/routes/router';
import { NOTE_ID, signIn } from '@/test/editor-fixtures';
import { errorBody } from '@/test/fixtures';
import { createTestQueryClient } from '@/test/render';
import { server } from '@/test/server';

const LOAD = { timeout: 10_000 };

// The editor chunk pulls in TipTap; loading it cold can take several seconds under coverage.
beforeAll(async () => {
  await import('./note-editor-page');
}, 60_000);

const renderApp = () => {
  const router = createMemoryRouter(routes, { initialEntries: [`/notes/${NOTE_ID}`] });
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
};

describe('note editor page', () => {
  it("S-AB1012-07: a missing or other user's note shows not-found and an unrenewable session goes to login", async () => {
    signIn();
    server.use(
      http.get(`*/api/v1/notes/${NOTE_ID}`, () =>
        HttpResponse.json(errorBody('NOTE_NOT_FOUND', 'Note not found'), { status: 404 }),
      ),
    );
    const first = renderApp();
    expect(
      await screen.findByRole('heading', { name: 'Note not found' }, LOAD),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to your notes' })).toHaveAttribute(
      'href',
      '/notes',
    );
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    first.dispose();

    server.use(
      http.get(`*/api/v1/notes/${NOTE_ID}`, () =>
        HttpResponse.json(errorBody('UNAUTHORIZED', 'Sign in again'), { status: 401 }),
      ),
      http.post('*/api/v1/auth/refresh', () =>
        HttpResponse.json(errorBody('INVALID_REFRESH_TOKEN', 'Session expired'), { status: 401 }),
      ),
    );
    signIn();
    cleanup();
    const second = renderApp();
    expect(await screen.findByRole('heading', { name: 'Sign in' }, LOAD)).toBeInTheDocument();
    expect(second.state.location.pathname).toBe('/login');
  });

  it('shows a retryable error when the note cannot be loaded for another reason', async () => {
    signIn();
    server.use(
      http.get(`*/api/v1/notes/${NOTE_ID}`, () =>
        HttpResponse.json(errorBody('INTERNAL_ERROR', 'Server error'), { status: 500 }),
      ),
    );
    renderApp();
    expect(
      await screen.findByText('The note could not be loaded.', undefined, LOAD),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
