import { NoteResponseSchema, TrashListResponseSchema } from '@note-app/shared';
import { apiFetch } from '@/lib/api-client';

export const listTrash = (page: number) =>
  apiFetch(`/notes/trash?page=${page}`, TrashListResponseSchema);

export const restoreNote = (noteId: string) =>
  apiFetch(`/notes/${noteId}/restore`, NoteResponseSchema, { method: 'POST' });
