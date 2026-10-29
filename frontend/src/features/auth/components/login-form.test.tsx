import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { authResponse, errorBody } from '@/test/fixtures';
import { renderWithQuery } from '@/test/render';
import { server } from '@/test/server';
import { LoginForm } from './login-form';

const submit = () =>
  userEvent.setup().click(screen.getByRole('button', { name: 'Sign in' }));

const fill = async (email: string, password: string) => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), password);
};

describe('LoginForm', () => {
  it('S-AB1010-03: wrong credentials and network failure', async () => {
    server.use(
      http.post('*/api/v1/auth/login', () =>
        HttpResponse.json(errorBody('INVALID_CREDENTIALS', 'Invalid email or password'), {
          status: 401,
        }),
      ),
    );
    const onSuccess = vi.fn();
    renderWithQuery(<LoginForm onSuccess={onSuccess} />);
    await fill('ada@example.com', 'wrong-pass-1');
    await submit();

    // One generic message, attached to neither field.
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Password')).not.toHaveAttribute('aria-invalid', 'true');

    // Network failure: a retry message, and the typed values stay.
    server.use(http.post('*/api/v1/auth/login', () => HttpResponse.error()));
    await submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not reach the server. Check your connection and try again.',
    );
    expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com');
    expect(screen.getByLabelText('Password')).toHaveValue('wrong-pass-1');

    // Submitting again sends the request.
    let requests = 0;
    server.use(
      http.post('*/api/v1/auth/login', () => {
        requests += 1;
        return HttpResponse.json(authResponse());
      }),
    );
    await submit();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(requests).toBe(1);
  });

  it('validates with the shared schema before sending', async () => {
    let requests = 0;
    server.use(
      http.post('*/api/v1/auth/login', () => {
        requests += 1;
        return HttpResponse.json(authResponse());
      }),
    );
    renderWithQuery(<LoginForm onSuccess={vi.fn()} />);
    await submit();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(requests).toBe(0);
  });

  it('shows the server message for any other error', async () => {
    server.use(
      http.post('*/api/v1/auth/login', () =>
        HttpResponse.json(errorBody('INTERNAL_ERROR', 'Something broke'), { status: 500 }),
      ),
    );
    renderWithQuery(<LoginForm onSuccess={vi.fn()} />);
    await fill('ada@example.com', 'pass-word-1');
    await submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    );
  });
});
