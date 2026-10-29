import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { errorBody } from '@/test/fixtures';
import { createTestQueryClient } from '@/test/render';
import { server } from '@/test/server';
import { Component as ForgotPasswordPage } from './forgot-password-page';
import { Component as ResetPasswordPage } from './reset-password-page';

const renderAt = (path: string) => {
  const router = createMemoryRouter(
    [
      { path: '/forgot-password', Component: ForgotPasswordPage },
      { path: '/reset-password', Component: ResetPasswordPage },
      { path: '/login', element: <h1>Sign in stub</h1> },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
};

describe('forgot and reset password pages', () => {
  it('S-AB1010-07: forgot-password page sends the email and moves to the reset step', async () => {
    const user = userEvent.setup();
    const requests: unknown[] = [];
    server.use(
      http.post('*/api/v1/auth/forgot-password', async ({ request }) => {
        requests.push(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const router = renderAt('/forgot-password');

    // Client side: an invalid email is rejected before anything is sent.
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Send reset code' }));
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(requests).toHaveLength(0);

    // Server side: a valid email is sent once and the reset step opens, email pre-filled.
    await user.clear(screen.getByLabelText('Email'));
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset code' }));
    expect(await screen.findByRole('heading', { name: 'Reset your password' })).toBeInTheDocument();
    expect(requests).toEqual([{ email: 'ada@example.com' }]);
    expect(router.state.location.pathname).toBe('/reset-password');
    expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com');
  });

  it('S-AB1010-08: reset page with OTP and new password, shows OTP_INVALID_OR_EXPIRED, then goes to login', async () => {
    const user = userEvent.setup();
    renderAt('/reset-password?email=ada%40example.com');
    expect(await screen.findByLabelText('Email')).toHaveValue('ada@example.com');

    // Client side: a malformed OTP and a weak password are rejected before anything is sent.
    let requests = 0;
    server.use(
      http.post('*/api/v1/auth/reset-password', () => {
        requests += 1;
        return HttpResponse.json(errorBody('OTP_INVALID_OR_EXPIRED'), { status: 400 });
      }),
    );
    await user.type(screen.getByLabelText('6-digit code'), '12a456');
    await user.type(screen.getByLabelText('New password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(screen.getByLabelText('6-digit code')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('New password')).toHaveAttribute('aria-invalid', 'true');
    expect(requests).toBe(0);

    // Server side: a well-formed submission rejected as OTP_INVALID_OR_EXPIRED keeps the values
    // and shows one message naming neither field.
    await user.clear(screen.getByLabelText('6-digit code'));
    await user.type(screen.getByLabelText('6-digit code'), '123456');
    await user.clear(screen.getByLabelText('New password'));
    await user.type(screen.getByLabelText('New password'), 'correct-horse-9');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That code is invalid or has expired. Request a new one.',
    );
    expect(screen.getByLabelText('6-digit code')).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('New password')).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('6-digit code')).toHaveValue('123456');
    expect(screen.getByLabelText('New password')).toHaveValue('correct-horse-9');
    expect(requests).toBe(1);

    // Submitting again and getting 204 sends the user to login.
    server.use(
      http.post('*/api/v1/auth/reset-password', () => new HttpResponse(null, { status: 204 })),
    );
    await user.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(await screen.findByRole('heading', { name: 'Sign in stub' })).toBeInTheDocument();
    expect(requests).toBe(1);
  });
});
