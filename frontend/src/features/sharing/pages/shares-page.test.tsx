import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ActiveShareLinkListResponse } from '@note-app/shared';
import { HttpResponse, http } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { useAuthStore } from '@/features/auth/session-store';
import { routes } from '@/routes/router';
import { authResponse, errorBody, shareLink } from '@/test/fixtures';
import { createTestQueryClient } from '@/test/render';
import { server } from '@/test/server';

const A = shareLink({
  id: '01936f3e-8c2a-7b4d-9e1f-0a1b2c3d4e01',
  noteId: '01936f3e-8c2a-7b4d-9e1f-0a1b2c3d4e91',
  token: 'a'.repeat(43),
  viewCount: 3,
});
const B = shareLink({
  id: '01936f3e-8c2a-7b4d-9e1f-0a1b2c3d4e02',
  noteId: '01936f3e-8c2a-7b4d-9e1f-0a1b2c3d4e92',
  token: 'b'.repeat(43),
  expiresAt: '2027-01-01T00:00:00.000Z',
});

const list = (items: ActiveShareLinkListResponse['items'], extra = {}) => ({
  items,
  page: 1,
  pageSize: 20,
  total: items.length,
  totalPages: items.length === 0 ? 0 : 1,
  ...extra,
});

const renderShares = (path = '/shares') => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
};

const signIn = () => useAuthStore.getState().setSession(authResponse());

describe('active share links page', () => {
  it('S-AB1014-03: active links page lists links across notes and revokes one', async () => {
    signIn();
    let items = [
      { ...A, noteTitle: 'Alpha note' },
      { ...B, noteTitle: 'Beta note' },
    ];
    const revoked: string[] = [];
    server.use(
      http.get('*/api/v1/shares', () => HttpResponse.json(list(items))),
      http.post('*/api/v1/shares/:shareId/revoke', ({ params }) => {
        revoked.push(String(params['shareId']));
        items = items.filter((item) => item.id !== params['shareId']);
        return HttpResponse.json({ ...A, status: 'revoked' });
      }),
    );
    const user = userEvent.setup();
    renderShares();

    const rows = await screen.findAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0] as HTMLElement).getByText('Alpha note')).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText('Views: 3')).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText('Expires: Never')).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).queryByText('Expires: Never')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Revoke' })).toHaveLength(2);

    await user.click(within(rows[0] as HTMLElement).getByRole('button', { name: 'Revoke' }));
    await user.click(await screen.findByRole('button', { name: 'Revoke link' }));
    await waitFor(() => expect(screen.queryByText('Alpha note')).toBeNull());
    expect(revoked).toEqual([A.id]);
    expect(screen.getByText('Beta note')).toBeInTheDocument();

    // With nothing left, an empty state.
    items = [];
    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    await user.click(await screen.findByRole('button', { name: 'Revoke link' }));
    expect(await screen.findByText('You have no active share links.')).toBeInTheDocument();
  });

  it('S-AB1014-06: 401 on a share endpoint ends the session', async () => {
    signIn();
    let listed = 0;
    server.use(
      http.get('*/api/v1/shares', () => {
        listed += 1;
        return HttpResponse.json(errorBody('UNAUTHORIZED', 'Sign in required'), { status: 401 });
      }),
    );
    const router = renderShares();
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(useAuthStore.getState().status).toBe('guest');
    expect(listed).toBe(1);

    // A guest who opens /shares directly never calls the API.
    listed = 0;
    const guestRouter = renderShares();
    await waitFor(() => expect(guestRouter.state.location.pathname).toBe('/login'));
    expect(listed).toBe(0);
  });

  it('shows loading, then an error with retry', async () => {
    signIn();
    server.use(
      http.get('*/api/v1/shares', () =>
        HttpResponse.json(errorBody('INTERNAL_ERROR'), { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderShares();
    expect(await screen.findByText('Loading links…')).toBeInTheDocument();
    expect(await screen.findByText('Could not load your share links.')).toBeInTheDocument();
    server.use(
      http.get('*/api/v1/shares', () =>
        HttpResponse.json(list([{ ...A, noteTitle: 'Alpha note' }])),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Alpha note')).toBeInTheDocument();
  });

  it('keeps the page in the URL and pages through the links', async () => {
    signIn();
    const pages: string[] = [];
    server.use(
      http.get('*/api/v1/shares', ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page'));
        pages.push(String(page));
        return HttpResponse.json(
          list([{ ...A, noteTitle: `Note on page ${page}` }], { page, total: 40, totalPages: 2 }),
        );
      }),
    );
    const user = userEvent.setup();
    const router = renderShares('/shares?page=2');
    expect(await screen.findByText('Note on page 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Previous' }));
    expect(await screen.findByText('Note on page 1')).toBeInTheDocument();
    expect(router.state.location.search).toBe('');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Note on page 2')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?page=2');
    expect(pages).toEqual(['2', '1', '2']);
  });

  it('falls back to page 1 for a bad page parameter', async () => {
    signIn();
    server.use(
      http.get('*/api/v1/shares', ({ request }) =>
        HttpResponse.json(
          list([{ ...A, noteTitle: `page=${new URL(request.url).searchParams.get('page')}` }]),
        ),
      ),
    );
    renderShares('/shares?page=abc');
    expect(await screen.findByText('page=1')).toBeInTheDocument();
  });
});
