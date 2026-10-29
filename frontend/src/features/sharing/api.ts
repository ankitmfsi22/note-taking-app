import {
  ActiveShareLinkListResponseSchema,
  PublicSharedNoteSchema,
  ShareLinkListResponseSchema,
  ShareLinkResponseSchema,
  type CreateShareLinkRequest,
} from '@note-app/shared';
import { apiFetch } from '@/lib/api-client';

export const createShare = (noteId: string, body: CreateShareLinkRequest) =>
  apiFetch(`/notes/${encodeURIComponent(noteId)}/shares`, ShareLinkResponseSchema, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

export const listNoteShares = (noteId: string) =>
  apiFetch(`/notes/${encodeURIComponent(noteId)}/shares`, ShareLinkListResponseSchema);

export const listActiveShares = (page: number) =>
  apiFetch(`/shares?page=${page}&pageSize=20`, ActiveShareLinkListResponseSchema);

export const revokeShare = (shareId: string) =>
  apiFetch(`/shares/${encodeURIComponent(shareId)}/revoke`, ShareLinkResponseSchema, {
    method: 'POST',
  });

// Public: no Bearer header and no refresh-and-retry.
export const getPublicShare = (token: string) =>
  apiFetch(`/public/shares/${encodeURIComponent(token)}`, PublicSharedNoteSchema, {
    auth: false,
  });
