import { z } from 'zod';
import { TAG_NAME_MAX } from '../constants/limits.js';
import { IdSchema } from './common.js';

// Pulled forward from AB-1006 because note list items carry their tags (AB-1005 design).
export const TagResponseSchema = z.object({
  id: IdSchema,
  name: z.string().max(TAG_NAME_MAX),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  createdAt: z.iso.datetime(),
});
