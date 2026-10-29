import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/test/render';
import { server } from '@/test/server';
import { ForgotPasswordForm } from './forgot-password-form';

const submit = () =>
  userEvent.setup().click(screen.getByRole('button', { name: 'Send reset code' }));

describe('ForgotPasswordForm', () => {
  it('shows a retry message on a network failure and keeps the typed email', async () => {
    const user = userEvent.setup();
    server.use(http.post('*/api/v1/auth/forgot-password', () => HttpResponse.error()));
    const onRequested = vi.fn();
    renderWithQuery(<ForgotPasswordForm onRequested={onRequested} />);
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not reach the server. Check your connection and try again.',
    );
    expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com');
    expect(onRequested).not.toHaveBeenCalled();
  });

  it('calls onRequested with the submitted email on success', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/v1/auth/forgot-password', () => new HttpResponse(null, { status: 204 })),
    );
    const onRequested = vi.fn();
    renderWithQuery(<ForgotPasswordForm onRequested={onRequested} />);
    await user.type(screen.getByLabelText('Email'), 'ADA@Example.com');
    await submit();
    await waitFor(() => expect(onRequested).toHaveBeenCalledWith('ada@example.com'));
  });
});
