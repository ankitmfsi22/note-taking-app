import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '@/lib/api-client';

export const MESSAGES = {
  invalidCredentials: 'Email or password is incorrect.',
  network: 'Could not reach the server. Check your connection and try again.',
  emailTaken: 'An account with this email already exists.',
  generic: 'Something went wrong. Please try again.',
} as const;

// Puts a failed auth request onto the form (AC-FEAUTH-02): server details go to their field,
// everything else becomes one form-level message under `root.server`.
export const applyServerError = <T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
) => {
  const isField = (name: string): name is Path<T> => (fields as readonly string[]).includes(name);
  const formError = (message: string) => setError('root.server', { type: 'server', message });

  if (!(error instanceof ApiError)) return formError(MESSAGES.generic);

  switch (error.code) {
    case 'NETWORK_ERROR':
      return formError(MESSAGES.network);
    case 'INVALID_CREDENTIALS':
      return formError(MESSAGES.invalidCredentials);
    case 'EMAIL_TAKEN': {
      const email: string = 'email';
      if (isField(email)) return setError(email, { type: 'server', message: MESSAGES.emailTaken });
      return formError(MESSAGES.emailTaken);
    }
    case 'VALIDATION_ERROR': {
      const unmatched: string[] = [];
      for (const detail of error.details ?? []) {
        if (isField(detail.field)) setError(detail.field, { type: 'server', message: detail.message });
        else unmatched.push(detail.message);
      }
      if (unmatched.length > 0 || !error.details?.length) {
        formError(unmatched.join(' ') || error.message);
      }
      return;
    }
    default:
      return formError(MESSAGES.generic);
  }
};
