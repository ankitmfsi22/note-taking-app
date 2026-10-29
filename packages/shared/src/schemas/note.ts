import { z } from 'zod';
import { LIST_TAG_IDS_MAX, PREVIEW_MAX, TITLE_MAX } from '../constants/limits.js';
import { IdSchema, PaginationQuerySchema, paginated } from './common.js';
import { TagResponseSchema } from './tag.js';
import { EMPTY_DOC, TipTapDocSchema } from './tiptap.js';

const TitleSchema = z.string().trim().min(1).max(TITLE_MAX);

export const NoteCreateRequestSchema = z.strictObject({
  title: TitleSchema,
  content: TipTapDocSchema.default(() => structuredClone(EMPTY_DOC)),
});

export const NoteUpdateRequestSchema = z
  .strictObject({
    title: TitleSchema.optional(),
    content: TipTapDocSchema.optional(),
  })
  .refine((body) => body.title !== undefined || body.content !== undefined, {
    message: 'At least one of title and content is required',
  });

export const NoteIdParamsSchema = z.object({ noteId: IdSchema });

export const NoteResponseSchema = z.object({
  id: IdSchema,
  title: z.string(),
  content: TipTapDocSchema,
  // Always empty until AB-1006 replaces the item schema with TagResponseSchema.
  tags: z.array(z.never()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const TrashListItemSchema = z.object({
  id: IdSchema,
  title: z.string(),
  preview: z.string().max(PREVIEW_MAX),
  deletedAt: z.iso.datetime(),
  purgeAt: z.iso.datetime(),
  daysRemaining: z.int().min(0),
});

export const TrashListResponseSchema = paginated(TrashListItemSchema);

// Comma-separated UUIDs; duplicates go before the limit, and an empty entry fails as a non-UUID.
const TagIdsQuerySchema = z
  .string()
  .transform((value) => [...new Set(value.split(','))])
  .pipe(z.array(IdSchema).min(1).max(LIST_TAG_IDS_MAX));

export const NoteListQuerySchema = PaginationQuerySchema.extend({
  sortBy: z.enum(['updatedAt', 'createdAt', 'title']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  tagIds: TagIdsQuerySchema.optional(),
});

export const NoteListItemSchema = z.object({
  id: IdSchema,
  title: z.string(),
  preview: z.string().max(PREVIEW_MAX),
  tags: z.array(TagResponseSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const NoteListResponseSchema = paginated(NoteListItemSchema);
