import { z } from 'zod';
import { IdSchema, paginated } from './common.js';
import { TipTapDocSchema } from './tiptap.js';

const VersionNumberSchema = z.int().min(1);

export const VersionParamsSchema = z.object({
  noteId: IdSchema,
  // Path params arrive as text, so the number is coerced (like pagination).
  versionNumber: z.coerce.number().pipe(VersionNumberSchema),
});

export const VersionListItemSchema = z.object({
  versionNumber: VersionNumberSchema,
  title: z.string(),
  createdAt: z.iso.datetime(),
});

export const VersionListResponseSchema = paginated(VersionListItemSchema);

export const VersionDetailSchema = z.object({
  versionNumber: VersionNumberSchema,
  title: z.string(),
  content: TipTapDocSchema,
  createdAt: z.iso.datetime(),
});
