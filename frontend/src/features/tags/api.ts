import {
  TagListResponseSchema,
  TagResponseSchema,
  type TagCreateRequest,
  type TagUpdateRequest,
} from '@note-app/shared';
import { apiFetch, apiSend } from '@/lib/api-client';

const json = (method: string, body: unknown) => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export const listTags = () => apiFetch('/tags', TagListResponseSchema);

export const createTag = (body: TagCreateRequest) =>
  apiFetch('/tags', TagResponseSchema, json('POST', body));

export const updateTag = (tagId: string, body: TagUpdateRequest) =>
  apiFetch(`/tags/${tagId}`, TagResponseSchema, json('PATCH', body));

export const deleteTag = (tagId: string) => apiSend(`/tags/${tagId}`, { method: 'DELETE' });
