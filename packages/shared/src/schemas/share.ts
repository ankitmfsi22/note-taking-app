import { z } from 'zod';
import { TITLE_MAX } from '../constants/limits.js';
import { IdSchema, paginated } from './common.js';
import { TipTapDocSchema } from './tiptap.js';

// 32 random bytes as unpadded base64url are always 43 characters.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const TokenSchema = z.string().regex(TOKEN_PATTERN);

// The range (future, at most 365 days) needs the injected Clock, so the service checks it.
export const CreateShareLinkRequestSchema = z.strictObject({
  expiresAt: z.iso.datetime().optional(),
});

export const ShareIdParamsSchema = z.object({ shareId: IdSchema });
export const ShareTokenParamsSchema = z.object({ token: TokenSchema });

export const ShareLinkStatusSchema = z.enum(['active', 'expired', 'revoked']);

export const ShareLinkResponseSchema = z.object({
  id: IdSchema,
  noteId: IdSchema,
  token: TokenSchema,
  expiresAt: z.iso.datetime().nullable(),
  revokedAt: z.iso.datetime().nullable(),
  viewCount: z.int().min(0),
  status: ShareLinkStatusSchema,
  createdAt: z.iso.datetime(),
});

export const ShareLinkListResponseSchema = z.strictObject({
  items: z.array(ShareLinkResponseSchema),
});

export const ActiveShareLinkItemSchema = ShareLinkResponseSchema.extend({
  noteTitle: z.string().min(1).max(TITLE_MAX),
});

export const ActiveShareLinkListResponseSchema = paginated(ActiveShareLinkItemSchema);

export const PublicSharedNoteSchema = z.strictObject({
  title: z.string().min(1).max(TITLE_MAX),
  content: TipTapDocSchema,
  updatedAt: z.iso.datetime(),
});
