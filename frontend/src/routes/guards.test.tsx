import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { useAuthStore } from '@/features/auth/session-store';
import { authResponse } from '@/test/fixtures';
import { createTestQueryClient } from '@/test/render';
import { server } from '@/test/server';
import { routes } from './router';

// The first lazy import is transformed cold and can take over the 1 s default on Windows.
const LOAD = { timeout: 5000 };

const renderApp = (path: string) => {
  const queryClient = createTestQueryClient();
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { queryClient, router };
};

const loginHeading = () => screen.findByRole('heading', { name: 'Sign in' }, LOAD);
const notesHeading = () => screen.findByRole('heading', { name: 'Your notes' }, LOAD);

const signedInRefresh = () =>
  server.use(http.post('*/api/v1/auth/refresh', () => HttpResponse.json(authResponse('boot'))));

describe('session bootstrap and guards', () => {
  it('S-AB1010-04: reload keeps or ends the session', async () => {
    // Refresh succeeds: the notes page shows and the login page never appears first.
    signedInRefresh();
    const first = renderApp('/notes');
    expect(await notesHeading()).toBeInTheDocument();
    expect(first.router.state.navigation.state).toBe('idle');
    expect(first.router.state.location.pathname).toBe('/notes');
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', accessToken: 'boot' });
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).not.toContain('boot');
    first.router.dispose();
    cleanup();

    // Refresh is rejected (the default handler): the login page shows.
    server.resetHandlers();
    useAuthStore.setState(useAuthStore.getInitialState(), true);
    const second = renderApp('/notes');
    expect(await loginHeading()).toBeInTheDocument();
    expect(second.router.state.location.pathname).toBe('/login');
    expect(useAuthStore.getState().status).toBe('guest');
  });

  it('S-AB1010-06: guards redirect and logout ends the session', async () => {
    const user = userEvent.setup();

    // A guest on a protected page is sent to login (authorization denied).
    const guest = renderApp('/notes');
    expect(await loginHeading()).toBeInTheDocument();
    guest.router.dispose();
    cleanup();
    useAuthStore.setState(useAuthStore.getInitialState(), true); // a fresh page load

    // A signed-in user on /login or /register is sent to the notes list.
    signedInRefresh();
    const { queryClient, router } = renderApp('/register');
    expect(await notesHeading()).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/notes');
    await act(() => router.navigate('/login'));
    expect(router.state.location.pathname).toBe('/notes');

    // Logout: request sent, store cleared, cache emptied, login page shown.
    let logoutCalls = 0;
    server.use(
      http.post('*/api/v1/auth/logout', () => {
        logoutCalls += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    queryClient.setQueryData(['notes', 'list', {}], { items: [] });
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(await loginHeading()).toBeInTheDocument();
    expect(logoutCalls).toBe(1);
    expect(useAuthStore.getState()).toMatchObject({
      status: 'guest',
      user: null,
      accessToken: null,
    });
    expect(queryClient.getQueryData(['notes', 'list', {}])).toBeUndefined();
  });

  it('sends the user to login when the session ends while a protected page is open', async () => {
    signedInRefresh();
    renderApp('/notes');
    expect(await notesHeading()).toBeInTheDocument();
    act(() => useAuthStore.getState().clearSession());
    expect(await loginHeading()).toBeInTheDocument();
  });

  it('treats a network failure during bootstrap as a guest', async () => {
    server.use(http.post('*/api/v1/auth/refresh', () => HttpResponse.error()));
    renderApp('/notes');
    expect(await loginHeading()).toBeInTheDocument();
    expect(useAuthStore.getState().status).toBe('guest');
  });

  it('ends the session locally even when the logout request fails', async () => {
    const user = userEvent.setup();
    signedInRefresh();
    server.use(http.post('*/api/v1/auth/logout', () => HttpResponse.error()));
    renderApp('/notes');
    expect(await notesHeading()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(await loginHeading()).toBeInTheDocument();
    await waitFor(() => expect(useAuthStore.getState().status).toBe('guest'));
  });
});
