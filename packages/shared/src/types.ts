import type { z } from 'zod';
import type {
  AuthResponseSchema,
  ForgotPasswordRequestSchema,
  LoginRequestSchema,
  PublicUserSchema,
  RegisterRequestSchema,
  ResetPasswordRequestSchema,
} from './schemas/auth.js';
import type {
  ErrorCodeSchema,
  ErrorDetailSchema,
  ErrorResponseSchema,
  IdSchema,
  PaginationQuerySchema,
} from './schemas/common.js';
import type { HealthResponseSchema } from './schemas/health.js';
import type {
  NoteCreateRequestSchema,
  NoteIdParamsSchema,
  NoteListItemSchema,
  NoteListQuerySchema,
  NoteListResponseSchema,
  NoteResponseSchema,
  NoteUpdateRequestSchema,
  TrashListItemSchema,
  TrashListResponseSchema,
} from './schemas/note.js';
import type {
  SearchQuerySchema,
  SearchResponseSchema,
  SearchResultItemSchema,
} from './schemas/search.js';
import type {
  ActiveShareLinkListResponseSchema,
  CreateShareLinkRequestSchema,
  PublicSharedNoteSchema,
  ShareIdParamsSchema,
  ShareLinkListResponseSchema,
  ShareLinkResponseSchema,
  ShareTokenParamsSchema,
} from './schemas/share.js';
import type {
  SetNoteTagsRequestSchema,
  TagCreateRequestSchema,
  TagIdParamsSchema,
  TagListResponseSchema,
  TagResponseSchema,
  TagUpdateRequestSchema,
  TagWithCountSchema,
} from './schemas/tag.js';
import type { TipTapDocSchema } from './schemas/tiptap.js';
import type {
  VersionDetailSchema,
  VersionListItemSchema,
  VersionListResponseSchema,
  VersionParamsSchema,
} from './schemas/version.js';

export type Id = z.infer<typeof IdSchema>;
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;
export type PublicUser = z.infer<typeof PublicUserSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type TipTapDoc = z.infer<typeof TipTapDocSchema>;
export type NoteCreateRequest = z.infer<typeof NoteCreateRequestSchema>;
export type NoteUpdateRequest = z.infer<typeof NoteUpdateRequestSchema>;
export type NoteIdParams = z.infer<typeof NoteIdParamsSchema>;
export type NoteResponse = z.infer<typeof NoteResponseSchema>;
export type TrashListItem = z.infer<typeof TrashListItemSchema>;
export type TrashListResponse = z.infer<typeof TrashListResponseSchema>;
export type CreateShareLinkRequest = z.infer<typeof CreateShareLinkRequestSchema>;
export type ShareIdParams = z.infer<typeof ShareIdParamsSchema>;
export type ShareTokenParams = z.infer<typeof ShareTokenParamsSchema>;
export type ShareLinkResponse = z.infer<typeof ShareLinkResponseSchema>;
export type ShareLinkListResponse = z.infer<typeof ShareLinkListResponseSchema>;
export type ActiveShareLinkListResponse = z.infer<typeof ActiveShareLinkListResponseSchema>;
export type PublicSharedNote = z.infer<typeof PublicSharedNoteSchema>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type SearchResultItem = z.infer<typeof SearchResultItemSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
export type TagResponse = z.infer<typeof TagResponseSchema>;
export type TagCreateRequest = z.infer<typeof TagCreateRequestSchema>;
export type TagUpdateRequest = z.infer<typeof TagUpdateRequestSchema>;
export type TagIdParams = z.infer<typeof TagIdParamsSchema>;
export type TagWithCount = z.infer<typeof TagWithCountSchema>;
export type TagListResponse = z.infer<typeof TagListResponseSchema>;
export type SetNoteTagsRequest = z.infer<typeof SetNoteTagsRequestSchema>;
export type NoteListQuery = z.infer<typeof NoteListQuerySchema>;
export type NoteListItem = z.infer<typeof NoteListItemSchema>;
export type NoteListResponse = z.infer<typeof NoteListResponseSchema>;
export type VersionParams = z.infer<typeof VersionParamsSchema>;
export type VersionListItem = z.infer<typeof VersionListItemSchema>;
export type VersionListResponse = z.infer<typeof VersionListResponseSchema>;
export type VersionDetail = z.infer<typeof VersionDetailSchema>;
