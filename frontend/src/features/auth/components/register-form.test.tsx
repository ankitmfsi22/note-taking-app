import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { authResponse, errorBody } from '@/test/fixtures';
import { renderWithQuery } from '@/test/render';
import { server } from '@/test/server';
import { RegisterForm } from './register-form';

const fill = async (email: string, password: string, displayName = '') => {
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText('Email'));
  await user.type(screen.getByLabelText('Email'), email);
  await user.clear(screen.getByLabelText('Password'));
  await user.type(screen.getByLabelText('Password'), password);
  if (displayName) await user.type(screen.getByLabelText('Display name (optional)'), displayName);
  await user.click(screen.getByRole('button', { name: 'Create account' }));
};

describe('RegisterForm', () => {
  it('S-AB1010-01: register validates before sending and shows server field errors', async () => {
    let requests = 0;
    server.use(
      http.post('*/api/v1/auth/register', () => {
        requests += 1;
        return HttpResponse.json(errorBody('EMAIL_TAKEN', 'Email already registered'), {
          status: 409,
        });
      }),
    );
    renderWithQuery(<RegisterForm onSuccess={vi.fn()} />);

    // Client side: the shared schema rejects both fields and nothing is sent.
    await fill('not-an-email', 'short');
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(requests).toBe(0);

    // Server side: 409 EMAIL_TAKEN lands on the email field and the values stay.
    await fill('ada@example.com', 'correct-horse-9');
    expect(
      await screen.findByText('An account with this email already exists.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com');
    expect(screen.getByLabelText('Password')).toHaveValue('correct-horse-9');
    expect(requests).toBe(1);

    // Server side: 400 VALIDATION_ERROR details land on the named field.
    server.use(
      http.post('*/api/v1/auth/register', () =>
        HttpResponse.json(
          errorBody('VALIDATION_ERROR', 'Invalid input', [
            { field: 'password', message: 'Password is too common' },
          ]),
          { status: 400 },
        ),
      ),
    );
    await fill('ada@example.com', 'correct-horse-9');
    expect(await screen.findByText('Password is too common')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
  });

  it('omits an empty display name and sends the normalised email', async () => {
    let body: unknown;
    server.use(
      http.post('*/api/v1/auth/register', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(authResponse(), { status: 201 });
      }),
    );
    const onSuccess = vi.fn();
    renderWithQuery(<RegisterForm onSuccess={onSuccess} />);
    await fill('  Ada@Example.COM ', 'correct-horse-9');
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(body).toEqual({ email: 'ada@example.com', password: 'correct-horse-9' });
  });

  it('sends the display name when one is given', async () => {
    let body: unknown;
    server.use(
      http.post('*/api/v1/auth/register', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(authResponse(), { status: 201 });
      }),
    );
    const onSuccess = vi.fn();
    renderWithQuery(<RegisterForm onSuccess={onSuccess} />);
    await fill('ada@example.com', 'correct-horse-9', 'Ada');
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(body).toMatchObject({ displayName: 'Ada' });
  });

  it('shows a form-level message for a validation detail that names no form field', async () => {
    server.use(
      http.post('*/api/v1/auth/register', () =>
        HttpResponse.json(
          errorBody('VALIDATION_ERROR', 'Invalid input', [
            { field: 'other', message: 'Odd field' },
          ]),
          { status: 400 },
        ),
      ),
    );
    renderWithQuery(<RegisterForm onSuccess={vi.fn()} />);
    await fill('ada@example.com', 'correct-horse-9');
    expect(await screen.findByRole('alert')).toHaveTextContent('Odd field');
  });
});
