import { z } from 'zod';
import { PREVIEW_MAX, TITLE_MAX } from '../constants/limits.js';
import { IdSchema, paginated } from './common.js';
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
