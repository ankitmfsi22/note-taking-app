import { cleanup, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { useAuthStore } from '@/features/auth/session-store';
import { authResponse, errorBody } from '@/test/fixtures';
import { renderRoute } from '@/test/render';
import { server } from '@/test/server';

const LOGIN = { name: 'Sign in' };

describe('notes pages and the session', () => {
  it('S-AB1011-06: guest and expired session go to login', async () => {
    // A guest: the bootstrap refresh is rejected (the default handler) and no data is requested.
    const requested: string[] = [];
    server.use(
      http.get('*/api/v1/notes/trash', () => {
        requested.push('trash');
        return HttpResponse.json({ items: [] });
      }),
    );
    const guest = renderRoute('/notes/trash');
    expect(await screen.findByRole('heading', LOGIN)).toBeInTheDocument();
    expect(guest.router.state.location.pathname).toBe('/login');
    expect(requested).toEqual([]);
    cleanup();
    useAuthStore.setState(useAuthStore.getInitialState(), true);

    // A signed-in user whose access token has expired and whose refresh is then rejected.
    let refreshes = 0;
    server.use(
      http.post('*/api/v1/auth/refresh', () => {
        refreshes += 1;
        return refreshes === 1
          ? HttpResponse.json(authResponse('boot'))
          : HttpResponse.json(errorBody('INVALID_REFRESH_TOKEN'), { status: 401 });
      }),
      http.get('*/api/v1/notes', () =>
        HttpResponse.json(errorBody('UNAUTHORIZED'), { status: 401 }),
      ),
      http.get('*/api/v1/tags', () => HttpResponse.json({ items: [] })),
    );
    renderRoute('/notes');
    expect(await screen.findByRole('heading', LOGIN)).toBeInTheDocument();
    expect(refreshes).toBe(2);
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
