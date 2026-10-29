import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { useAuthStore } from '@/features/auth/session-store';
import { authResponse } from '@/test/fixtures';
import { createTestQueryClient } from '@/test/render';
import { server } from '@/test/server';
import { Component as LoginPage } from './login-page';
import { Component as RegisterPage } from './register-page';

const renderAt = (path: string) => {
  const router = createMemoryRouter(
    [
      { path: '/login', Component: LoginPage },
      { path: '/register', Component: RegisterPage },
      { path: '/notes', element: <h1>Notes stub</h1> },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
};

// A response the test releases by hand, so the in-flight state can be observed.
const held = () => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { gate, release: () => release() };
};

const submitTwiceWhilePending = async (label: string, pendingLabel: string) => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: label }));
  const pending = await screen.findByRole('button', { name: pendingLabel });
  expect(pending).toBeDisabled();
  await user.click(pending);
};

describe('auth pages', () => {
  it('S-AB1010-02: login and register disable submit, then open the notes list', async () => {
    const user = userEvent.setup();
    const counts = { login: 0, register: 0 };
    const loginGate = held();
    const registerGate = held();
    server.use(
      http.post('*/api/v1/auth/login', async () => {
        counts.login += 1;
        await loginGate.gate;
        return HttpResponse.json(authResponse('from-login'));
      }),
      http.post('*/api/v1/auth/register', async () => {
        counts.register += 1;
        await registerGate.gate;
        return HttpResponse.json(authResponse('from-register'), { status: 201 });
      }),
    );

    renderAt('/login');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), 'pass-word-1');
    await submitTwiceWhilePending('Sign in', 'Signing in…');
    loginGate.release();
    expect(await screen.findByRole('heading', { name: 'Notes stub' })).toBeInTheDocument();
    expect(counts.login).toBe(1);
    expect(useAuthStore.getState().accessToken).toBe('from-login');
    cleanup();

    renderAt('/register');
    await user.type(screen.getByLabelText('Email'), 'new@example.com');
    await user.type(screen.getByLabelText('Password'), 'pass-word-1');
    await submitTwiceWhilePending('Create account', 'Creating account…');
    registerGate.release();
    expect(await screen.findByRole('heading', { name: 'Notes stub' })).toBeInTheDocument();
    expect(counts.register).toBe(1);
    await waitFor(() => expect(useAuthStore.getState().accessToken).toBe('from-register'));
  });

  it('links between the login and register pages', async () => {
    const user = userEvent.setup();
    renderAt('/login');
    await user.click(screen.getByRole('link', { name: 'Create an account' }));
    expect(await screen.findByRole('heading', { name: 'Create account' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Sign in instead' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });
});
