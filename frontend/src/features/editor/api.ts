import {
  NoteResponseSchema,
  TagListResponseSchema,
  type NoteUpdateRequest,
  type SetNoteTagsRequest,
} from '@note-app/shared';
import { apiFetch } from '@/lib/api-client';

const jsonBody = (method: string, body: unknown) => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export const getNote = (noteId: string) => apiFetch(`/notes/${noteId}`, NoteResponseSchema);

export const updateNote = (noteId: string, body: NoteUpdateRequest) =>
  apiFetch(`/notes/${noteId}`, NoteResponseSchema, jsonBody('PATCH', body));

export const setNoteTags = (noteId: string, body: SetNoteTagsRequest) =>
  apiFetch(`/notes/${noteId}/tags`, NoteResponseSchema, jsonBody('PUT', body));

export const listTags = () => apiFetch('/tags', TagListResponseSchema);
