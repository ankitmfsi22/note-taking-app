import { describe, expect, it } from 'vitest';
import { PaginationQuerySchema } from './common.js';
import {
  NoteCreateRequestSchema,
  NoteIdParamsSchema,
  NoteResponseSchema,
  NoteUpdateRequestSchema,
  TrashListResponseSchema,
} from './note.js';
import { EMPTY_DOC } from './tiptap.js';

const ID = '0190b0a0-0000-7000-8000-000000000001';
const AT = '2026-10-29T10:00:00.000Z';

describe('PaginationQuerySchema', () => {
  it('applies the defaults and coerces query strings', () => {
    expect(PaginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(PaginationQuerySchema.parse({ page: '2', pageSize: '100' })).toEqual({
      page: 2,
      pageSize: 100,
    });
  });

  it('rejects a page below 1 and a page size above 100', () => {
    expect(PaginationQuerySchema.safeParse({ page: '0' }).success).toBe(false);
    expect(PaginationQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false);
  });
});

describe('NoteCreateRequestSchema', () => {
  it('trims the title and defaults the content to the empty doc', () => {
    expect(NoteCreateRequestSchema.parse({ title: '  Groceries ' })).toEqual({
      title: 'Groceries',
      content: EMPTY_DOC,
    });
  });

  it('rejects a blank or 201-character title and unknown keys', () => {
    expect(NoteCreateRequestSchema.safeParse({ title: '   ' }).success).toBe(false);
    expect(NoteCreateRequestSchema.safeParse({ title: 'a'.repeat(201) }).success).toBe(false);
    expect(NoteCreateRequestSchema.safeParse({ title: 'a', contentText: 'x' }).success).toBe(false);
  });
});

describe('NoteUpdateRequestSchema', () => {
  it('accepts a title or content alone', () => {
    expect(NoteUpdateRequestSchema.parse({ title: ' New ' })).toEqual({ title: 'New' });
    expect(NoteUpdateRequestSchema.safeParse({ content: EMPTY_DOC }).success).toBe(true);
  });

  it('rejects an empty body', () => {
    expect(NoteUpdateRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('NoteIdParamsSchema', () => {
  it('accepts a UUID and rejects anything else', () => {
    expect(NoteIdParamsSchema.safeParse({ noteId: ID }).success).toBe(true);
    expect(NoteIdParamsSchema.safeParse({ noteId: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('NoteResponseSchema', () => {
  it('accepts a note and strips unlisted fields', () => {
    const note = {
      id: ID,
      title: 't',
      content: EMPTY_DOC,
      tags: [],
      latestVersion: 1,
      createdAt: AT,
      updatedAt: AT,
    };
    expect(NoteResponseSchema.parse({ ...note, userId: ID })).toEqual(note);
  });

  it('requires latestVersion to be an integer of at least 1', () => {
    const note = { id: ID, title: 't', content: EMPTY_DOC, tags: [], createdAt: AT, updatedAt: AT };
    expect(NoteResponseSchema.safeParse(note).success).toBe(false);
    expect(NoteResponseSchema.safeParse({ ...note, latestVersion: 0 }).success).toBe(false);
  });
});

describe('TrashListResponseSchema', () => {
  it('accepts a page of trashed notes and rejects a negative daysRemaining', () => {
    const item = { id: ID, title: 't', preview: '', deletedAt: AT, purgeAt: AT, daysRemaining: 30 };
    const page = { items: [item], page: 1, pageSize: 20, total: 1, totalPages: 1 };
    expect(TrashListResponseSchema.safeParse(page).success).toBe(true);
    expect(
      TrashListResponseSchema.safeParse({ ...page, items: [{ ...item, daysRemaining: -1 }] })
        .success,
    ).toBe(false);
  });
});
