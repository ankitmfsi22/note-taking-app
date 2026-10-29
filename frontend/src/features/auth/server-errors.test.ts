import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { applyServerError, MESSAGES } from './server-errors';

type Fields = { password: string };

const run = (error: unknown) => {
  const setError = vi.fn();
  applyServerError<Fields>(error, setError, ['password']);
  return setError.mock.calls;
};

describe('applyServerError', () => {
  it('shows the generic message for an error that is not an ApiError', () => {
    expect(run(new Error('boom'))).toEqual([
      ['root.server', { type: 'server', message: MESSAGES.generic }],
    ]);
  });

  it('puts EMAIL_TAKEN on the form when the form has no email field', () => {
    expect(run(new ApiError(409, 'EMAIL_TAKEN', 'taken'))).toEqual([
      ['root.server', { type: 'server', message: MESSAGES.emailTaken }],
    ]);
  });

  it('uses the server message for a VALIDATION_ERROR without details', () => {
    expect(run(new ApiError(400, 'VALIDATION_ERROR', 'Invalid input'))).toEqual([
      ['root.server', { type: 'server', message: 'Invalid input' }],
    ]);
  });
});
