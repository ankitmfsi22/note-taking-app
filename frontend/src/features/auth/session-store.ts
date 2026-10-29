import type { AuthResponse, PublicUser } from '@note-app/shared';
import { create } from 'zustand';

export type SessionStatus = 'unknown' | 'authenticated' | 'guest';

interface AuthState {
  status: SessionStatus;
  user: PublicUser | null;
  // Memory only (SDS 5.1): never copied to web storage or a readable cookie.
  accessToken: string | null;
  setSession: (auth: AuthResponse) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: 'unknown',
  user: null,
  accessToken: null,
  setSession: ({ user, accessToken }) => set({ status: 'authenticated', user, accessToken }),
  clearSession: () => set({ status: 'guest', user: null, accessToken: null }),
}));
