import type { NoteResponse, TagResponse } from '@note-app/shared';
import { QueryClientProvider } from '@tanstack/react-query';
import type { Editor } from '@tiptap/core';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { Toaster } from '@/app/toaster';
import { useAuthStore } from '@/features/auth/session-store';
import { createTestQueryClient } from './render';
import { authResponse } from './fixtures';

export const NOTE_ID = '01936f3e-8c2a-7b4d-9e1f-0a1b2c3d0001';

export const tagFixture = (n: number, name = `tag-${n}`): TagResponse => ({
  id: `01936f3e-8c2a-7b4d-9e1f-0a1b2c3d01${String(n).padStart(2, '0')}`,
  name,
  color: '#3366ff',
  createdAt: '2026-10-01T10:00:00.000Z',
});

export const noteFixture = (overrides: Partial<NoteResponse> = {}): NoteResponse => ({
  id: NOTE_ID,
  title: 'My note',
  content: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }],
  },
  tags: [],
  latestVersion: 1,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
  ...overrides,
});

export const signIn = () => useAuthStore.getState().setSession(authResponse());

// Renders the editor page route alone (no app shell), next to a stand-in notes page.
export const renderEditorRoute = (
  route: Pick<RouteObject, 'Component' | 'lazy'>,
  path = `/notes/${NOTE_ID}`,
) => {
  const router = createMemoryRouter(
    [
      { path: '/notes/:noteId', ...route },
      { path: '/notes', element: <h1>Notes page</h1> },
      { path: '/login', element: <h1>Login page</h1> },
    ],
    { initialEntries: [path] },
  );
  const queryClient = createTestQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>,
  );
  return { router, queryClient };
};

// TipTap keeps the editor on its DOM node, which lets a test type without a real keyboard.
export const getEditor = async (): Promise<Editor> => {
  const dom = await screen.findByLabelText('Note content');
  const editor = (dom as HTMLElement & { editor?: Editor }).editor;
  if (!editor) throw new Error('editor not mounted');
  return editor;
};
