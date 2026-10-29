import { NoteListResponseSchema, NoteResponseSchema } from '@note-app/shared';
import { apiFetch, apiSend } from '@/lib/api-client';
import { toSearchParams, type ListParams } from './list-params';

// Always sent, so the request shows exactly what the URL says (AC-FELIST-03).
const toQuery = (params: ListParams) => {
  const query = toSearchParams(params);
  query.set('page', String(params.page));
  query.set('sortBy', params.sortBy);
  query.set('sortOrder', params.sortOrder);
  return query.toString();
};

export const listNotes = (params: ListParams) =>
  apiFetch(`/notes?${toQuery(params)}`, NoteListResponseSchema);

export const createNote = () =>
  apiFetch('/notes', NoteResponseSchema, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Untitled note' }),
  });

export const deleteNote = (noteId: string) => apiSend(`/notes/${noteId}`, { method: 'DELETE' });
