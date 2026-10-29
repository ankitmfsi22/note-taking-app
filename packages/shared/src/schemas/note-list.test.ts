import { describe, expect, it } from 'vitest';
import { NoteListQuerySchema, NoteListResponseSchema } from './note.js';
import { TagResponseSchema } from './tag.js';

const ID = '0190b0a0-0000-7000-8000-000000000001';
const ID2 = '0190b0a0-0000-7000-8000-000000000002';
const AT = '2026-10-29T10:00:00.000Z';
const tagId = (n: number) => `0190b0a0-0000-7000-8000-${String(n).padStart(12, '0')}`;

describe('NoteListQuerySchema', () => {
  it('applies the defaults and coerces query strings', () => {
    expect(NoteListQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 20,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    });
    expect(
      NoteListQuerySchema.parse({ page: '2', pageSize: '5', sortBy: 'title', sortOrder: 'asc' }),
    ).toEqual({ page: 2, pageSize: 5, sortBy: 'title', sortOrder: 'asc' });
  });

  it('splits tagIds and removes duplicates before the limit', () => {
    const many = Array.from({ length: 10 }, (_, i) => tagId(i + 1));
    expect(NoteListQuerySchema.parse({ tagIds: `${ID},${ID2},${ID}` }).tagIds).toEqual([ID, ID2]);
    expect(NoteListQuerySchema.parse({ tagIds: [...many, many[0]].join(',') }).tagIds).toEqual(
      many,
    );
  });

  it('rejects bad pagination, an unknown sort and bad tagIds', () => {
    const rejected = [
      { page: '0' },
      { page: 'abc' },
      { pageSize: '101' },
      { sortBy: 'color' },
      { sortOrder: 'up' },
      { tagIds: 'not-a-uuid' },
      { tagIds: '' },
      { tagIds: Array.from({ length: 11 }, (_, i) => tagId(i + 1)).join(',') },
      { tagIds: [ID, ID2] },
    ];
    for (const query of rejected) {
      expect(NoteListQuerySchema.safeParse(query).success, JSON.stringify(query)).toBe(false);
    }
  });
});

describe('TagResponseSchema', () => {
  it('accepts a tag and rejects a bad color', () => {
    const tag = { id: ID, name: 'work', color: '#6B7280', createdAt: AT };
    expect(TagResponseSchema.parse({ ...tag, userId: ID })).toEqual(tag);
    expect(TagResponseSchema.safeParse({ ...tag, color: 'red' }).success).toBe(false);
  });
});

describe('NoteListResponseSchema', () => {
  it('accepts a page of list items and rejects a preview over 150 characters', () => {
    const tag = { id: ID2, name: 'work', color: '#6B7280', createdAt: AT };
    const item = { id: ID, title: 't', preview: 'p', tags: [tag], createdAt: AT, updatedAt: AT };
    const page = { items: [item], page: 1, pageSize: 20, total: 1, totalPages: 1 };
    expect(NoteListResponseSchema.parse(page)).toEqual(page);
    expect(
      NoteListResponseSchema.safeParse({ ...page, items: [{ ...item, preview: 'x'.repeat(151) }] })
        .success,
    ).toBe(false);
  });
});
