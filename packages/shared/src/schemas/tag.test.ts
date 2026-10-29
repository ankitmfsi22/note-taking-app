import { describe, expect, it } from 'vitest';
import { NoteResponseSchema } from './note.js';
import {
  SetNoteTagsRequestSchema,
  TagCreateRequestSchema,
  TagIdParamsSchema,
  TagListResponseSchema,
  TagUpdateRequestSchema,
} from './tag.js';
import { EMPTY_DOC } from './tiptap.js';

const ID = '0190b0a0-0000-7000-8000-000000000001';
const AT = '2026-10-29T10:00:00.000Z';
const ids = (n: number) =>
  Array.from({ length: n }, (_, i) => `0190b0a0-0000-7000-8000-${String(i).padStart(12, '0')}`);

describe('TagCreateRequestSchema', () => {
  it('trims the name and leaves the colour optional', () => {
    expect(TagCreateRequestSchema.parse({ name: '  Work ' })).toEqual({ name: 'Work' });
    expect(TagCreateRequestSchema.parse({ name: 'a', color: '#aBc123' }).color).toBe('#aBc123');
  });

  it('rejects a blank or 31-character name and a bad colour', () => {
    expect(TagCreateRequestSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(TagCreateRequestSchema.safeParse({ name: 'x'.repeat(31) }).success).toBe(false);
    expect(TagCreateRequestSchema.safeParse({ name: 'ok', color: 'red' }).success).toBe(false);
  });
});

describe('TagUpdateRequestSchema', () => {
  it('needs at least one of name or color', () => {
    expect(TagUpdateRequestSchema.safeParse({}).success).toBe(false);
    expect(TagUpdateRequestSchema.safeParse({ color: '#000000' }).success).toBe(true);
  });
});

describe('TagIdParamsSchema', () => {
  it('requires a uuid', () => {
    expect(TagIdParamsSchema.safeParse({ tagId: ID }).success).toBe(true);
    expect(TagIdParamsSchema.safeParse({ tagId: 'x' }).success).toBe(false);
  });
});

describe('SetNoteTagsRequestSchema', () => {
  it('removes duplicates before the limit of 10', () => {
    expect(SetNoteTagsRequestSchema.parse({ tagIds: [ID, ID] }).tagIds).toEqual([ID]);
    const eleven = [...ids(10), ids(10)[0]];
    expect(SetNoteTagsRequestSchema.safeParse({ tagIds: eleven }).success).toBe(true);
  });

  it('accepts an empty list and rejects 11 distinct ids or a non-uuid', () => {
    expect(SetNoteTagsRequestSchema.parse({ tagIds: [] }).tagIds).toEqual([]);
    expect(SetNoteTagsRequestSchema.safeParse({ tagIds: ids(11) }).success).toBe(false);
    expect(SetNoteTagsRequestSchema.safeParse({ tagIds: ['x'] }).success).toBe(false);
  });
});

describe('TagListResponseSchema and NoteResponseSchema', () => {
  it('parses counted tags and a note with tags', () => {
    const tag = { id: ID, name: 'Work', color: '#6B7280', createdAt: AT };
    expect(TagListResponseSchema.parse({ items: [{ ...tag, noteCount: 2 }] }).items).toHaveLength(
      1,
    );
    expect(TagListResponseSchema.safeParse({ items: [tag] }).success).toBe(false);
    const note = {
      id: ID,
      title: 't',
      content: EMPTY_DOC,
      tags: [tag],
      latestVersion: 1,
      createdAt: AT,
      updatedAt: AT,
    };
    expect(NoteResponseSchema.parse(note).tags).toEqual([tag]);
  });
});
