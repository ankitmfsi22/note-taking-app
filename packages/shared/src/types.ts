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
  NoteResponseSchema,
  NoteUpdateRequestSchema,
  TrashListItemSchema,
  TrashListResponseSchema,
} from './schemas/note.js';
import type { TipTapDocSchema } from './schemas/tiptap.js';

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
