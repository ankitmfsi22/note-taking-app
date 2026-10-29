import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { errorBody } from '@/test/fixtures';
import { renderWithQuery } from '@/test/render';
import { server } from '@/test/server';
import { ResetPasswordForm } from './reset-password-form';

describe('ResetPasswordForm', () => {
  it('ERR-PWD-05: shows a server VALIDATION_ERROR on the named field and keeps the OTP usable', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/v1/auth/reset-password', () =>
        HttpResponse.json(
          errorBody('VALIDATION_ERROR', 'Invalid input', [
            { field: 'newPassword', message: 'Password is too common' },
          ]),
          { status: 400 },
        ),
      ),
    );
    renderWithQuery(<ResetPasswordForm email="ada@example.com" onReset={vi.fn()} />);
    await user.type(screen.getByLabelText('6-digit code'), '123456');
    await user.type(screen.getByLabelText('New password'), 'correct-horse-9');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(await screen.findByText('Password is too common')).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('6-digit code')).toHaveValue('123456');
  });

  it('pre-fills the email it is given', () => {
    renderWithQuery(<ResetPasswordForm email="ada@example.com" onReset={vi.fn()} />);
    expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com');
  });
});
