import {
  NoteResponseSchema,
  PAGE_SIZE_DEFAULT,
  VersionDetailSchema,
  VersionListResponseSchema,
} from '@note-app/shared';
import { apiFetch } from '@/lib/api-client';

export const listVersions = (noteId: string, page: number) =>
  apiFetch(
    `/notes/${noteId}/versions?page=${page}&pageSize=${PAGE_SIZE_DEFAULT}`,
    VersionListResponseSchema,
  );

export const getVersion = (noteId: string, versionNumber: number) =>
  apiFetch(`/notes/${noteId}/versions/${versionNumber}`, VersionDetailSchema);

export const restoreVersion = (noteId: string, versionNumber: number) =>
  apiFetch(`/notes/${noteId}/versions/${versionNumber}/restore`, NoteResponseSchema, {
    method: 'POST',
  });
