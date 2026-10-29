import { describe, expect, it } from 'vitest';
import { SearchQuerySchema, SearchResponseSchema } from './search.js';

const ID = '0190b0a0-0000-7000-8000-000000000001';

describe('SearchQuerySchema', () => {
  it('trims q and applies the pagination defaults', () => {
    expect(SearchQuerySchema.parse({ q: '  budget ' })).toEqual({
      q: 'budget',
      page: 1,
      pageSize: 20,
    });
  });

  it('rejects a missing q, a q under 2 or over 200 characters after trimming', () => {
    expect(SearchQuerySchema.safeParse({}).success).toBe(false);
    expect(SearchQuerySchema.safeParse({ q: ' a ' }).success).toBe(false);
    expect(SearchQuerySchema.safeParse({ q: 'a'.repeat(201) }).success).toBe(false);
    expect(SearchQuerySchema.safeParse({ q: 'a'.repeat(200) }).success).toBe(true);
  });

  it('rejects a page size above 100', () => {
    expect(SearchQuerySchema.safeParse({ q: 'ok', pageSize: '101' }).success).toBe(false);
  });
});

describe('SearchResponseSchema', () => {
  it('accepts a page of results and rejects an item without a snippet', () => {
    const item = {
      id: ID,
      title: 'Budget',
      titleHighlight: '<mark>Budget</mark>',
      snippet: 'x',
      tags: [],
      updatedAt: '2026-10-29T10:00:00.000Z',
    };
    const page = { items: [item], page: 1, pageSize: 20, total: 1, totalPages: 1 };
    expect(SearchResponseSchema.safeParse(page).success).toBe(true);
    const { snippet: _snippet, ...broken } = item;
    expect(SearchResponseSchema.safeParse({ ...page, items: [broken] }).success).toBe(false);
  });
});
