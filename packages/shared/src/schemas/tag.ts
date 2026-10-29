import { z } from 'zod';
import { NOTE_TAGS_MAX, TAG_NAME_MAX } from '../constants/limits.js';
import { IdSchema } from './common.js';

const TagNameSchema = z.string().trim().min(1).max(TAG_NAME_MAX);
const TagColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

// Pulled forward from AB-1006 because note list items carry their tags (AB-1005 design).
export const TagResponseSchema = z.object({
  id: IdSchema,
  name: z.string().max(TAG_NAME_MAX),
  color: TagColorSchema,
  createdAt: z.iso.datetime(),
});

export const TagCreateRequestSchema = z.strictObject({
  name: TagNameSchema,
  color: TagColorSchema.optional(),
});

export const TagUpdateRequestSchema = z
  .strictObject({
    name: TagNameSchema.optional(),
    color: TagColorSchema.optional(),
  })
  .refine((body) => body.name !== undefined || body.color !== undefined, {
    message: 'At least one of name and color is required',
  });

export const TagIdParamsSchema = z.object({ tagId: IdSchema });

export const TagWithCountSchema = TagResponseSchema.extend({ noteCount: z.int().min(0) });

export const TagListResponseSchema = z.object({ items: z.array(TagWithCountSchema) });

// Duplicates go before the limit (FRS A-20), so eleven ids with a repeat are accepted.
export const SetNoteTagsRequestSchema = z.strictObject({
  tagIds: z
    .array(IdSchema)
    .transform((ids) => [...new Set(ids)])
    .pipe(z.array(IdSchema).max(NOTE_TAGS_MAX)),
});
