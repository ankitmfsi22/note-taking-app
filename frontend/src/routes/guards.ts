import { redirect } from 'react-router';
import { useAuthStore } from '@/features/auth/session-store';
import { refreshSession } from '@/lib/api-client';

let bootstrap: Promise<void> | null = null;

// Restores the session from the refresh cookie once per app start (SDS 9.3, AC-FEAUTH-05).
// React Router runs loaders in parallel, so every guard awaits this same promise.
export const ensureSession = (): Promise<void> => {
  if (useAuthStore.getState().status !== 'unknown') return Promise.resolve();
  bootstrap ??= refreshSession()
    .then(
      () => undefined,
      () => {
        // A network failure leaves the status unknown; without a session we are a guest.
        if (useAuthStore.getState().status === 'unknown') useAuthStore.getState().clearSession();
      },
    )
    .finally(() => {
      bootstrap = null;
    });
  return bootstrap;
};

export const rootLoader = async () => {
  await ensureSession();
  return null;
};

export const requireAuthLoader = async () => {
  await ensureSession();
  return useAuthStore.getState().status === 'authenticated' ? null : redirect('/login');
};

export const guestOnlyLoader = async () => {
  await ensureSession();
  return useAuthStore.getState().status === 'authenticated' ? redirect('/notes') : null;
};
