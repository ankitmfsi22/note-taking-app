import { z } from 'zod';
import { SEARCH_Q_MAX, SEARCH_Q_MIN } from '../constants/limits.js';
import { IdSchema, PaginationQuerySchema, paginated } from './common.js';

export const SearchQuerySchema = PaginationQuerySchema.extend({
  q: z.string().trim().min(SEARCH_Q_MIN).max(SEARCH_Q_MAX),
});

export const SearchResultItemSchema = z.object({
  id: IdSchema,
  title: z.string(),
  // HTML-escaped; the only markup is <mark> and </mark> (SDS 8.2).
  titleHighlight: z.string(),
  snippet: z.string(),
  // Always empty until AB-1006 replaces the item schema with TagResponseSchema.
  tags: z.array(z.never()),
  updatedAt: z.iso.datetime(),
});

export const SearchResponseSchema = paginated(SearchResultItemSchema);
