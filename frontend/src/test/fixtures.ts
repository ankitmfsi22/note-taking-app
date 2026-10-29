import type { AuthResponse, PublicUser, ShareLinkResponse } from '@note-app/shared';

export const testUser: PublicUser = {
  id: '01936f3e-8c2a-7b4d-9e1f-0a1b2c3d4e5f',
  email: 'ada@example.com',
  displayName: 'Ada',
  createdAt: '2026-10-01T10:00:00.000Z',
};

export const authResponse = (
  accessToken = 'access-1',
  user: PublicUser = testUser,
): AuthResponse => ({
  user,
  accessToken,
  expiresIn: 900,
});

export const shareLink = (overrides: Partial<ShareLinkResponse> = {}): ShareLinkResponse => ({
  id: '01936f3e-8c2a-7b4d-9e1f-0a1b2c3d4e01',
  noteId: '01936f3e-8c2a-7b4d-9e1f-0a1b2c3d4e99',
  token: 'A'.repeat(43),
  expiresAt: null,
  revokedAt: null,
  viewCount: 0,
  status: 'active',
  createdAt: '2026-10-29T10:00:00.000Z',
  ...overrides,
});

export const errorBody = (
  code: string,
  message = code,
  details?: { field: string; message: string }[],
) => ({
  error: { code, message, details, requestId: 'req-test' },
});
