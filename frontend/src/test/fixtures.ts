import type {
  AuthResponse,
  NoteListItem,
  PublicUser,
  TagWithCount,
  TrashListItem,
} from '@note-app/shared';

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

export const errorBody = (
  code: string,
  message = code,
  details?: { field: string; message: string }[],
) => ({
  error: { code, message, details, requestId: 'req-test' },
});

export const uuid = (n: number) => `0190b0a0-0000-7000-8000-${String(n).padStart(12, '0')}`;

export const tag = (n = 1, overrides: Partial<TagWithCount> = {}): TagWithCount => ({
  id: uuid(100 + n),
  name: `tag-${n}`,
  color: '#6B7280',
  createdAt: '2026-10-01T10:00:00.000Z',
  noteCount: 0,
  ...overrides,
});

export const noteListItem = (n = 1, overrides: Partial<NoteListItem> = {}): NoteListItem => ({
  id: uuid(n),
  title: `Note ${n}`,
  preview: `Preview ${n}`,
  tags: [],
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-02T10:00:00.000Z',
  ...overrides,
});

export const trashItem = (n = 1, overrides: Partial<TrashListItem> = {}): TrashListItem => ({
  id: uuid(200 + n),
  title: `Trashed ${n}`,
  preview: '',
  deletedAt: '2026-10-04T10:00:00.000Z',
  purgeAt: '2026-11-03T10:00:00.000Z',
  daysRemaining: 5,
  ...overrides,
});

export const pageOf = <T>(items: T[], overrides: Record<string, number> = {}) => ({
  items,
  page: 1,
  pageSize: 20,
  total: items.length,
  totalPages: items.length === 0 ? 0 : 1,
  ...overrides,
});
