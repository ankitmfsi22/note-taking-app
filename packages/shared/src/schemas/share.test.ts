import { describe, expect, it } from 'vitest';
import {
  ActiveShareLinkListResponseSchema,
  CreateShareLinkRequestSchema,
  PublicSharedNoteSchema,
  ShareIdParamsSchema,
  ShareLinkResponseSchema,
  ShareTokenParamsSchema,
} from './share.js';
import { EMPTY_DOC } from './tiptap.js';

const ID = '0190b0a0-0000-7000-8000-000000000001';
const AT = '2026-10-29T10:00:00.000Z';
const TOKEN = 'A'.repeat(43);

const link = {
  id: ID,
  noteId: ID,
  token: TOKEN,
  expiresAt: null,
  revokedAt: null,
  viewCount: 0,
  status: 'active',
  createdAt: AT,
};

describe('CreateShareLinkRequestSchema', () => {
  it('accepts an empty body and an ISO datetime', () => {
    expect(CreateShareLinkRequestSchema.parse({})).toEqual({});
    expect(CreateShareLinkRequestSchema.parse({ expiresAt: AT })).toEqual({ expiresAt: AT });
  });

  it('rejects a value that is not an ISO datetime', () => {
    expect(CreateShareLinkRequestSchema.safeParse({ expiresAt: 'not-a-date' }).success).toBe(false);
  });
});

describe('share params', () => {
  it('accepts a uuid share id and a 43-character base64url token', () => {
    expect(ShareIdParamsSchema.safeParse({ shareId: ID }).success).toBe(true);
    expect(ShareTokenParamsSchema.safeParse({ token: `${'a-_'.repeat(14)}a` }).success).toBe(true);
  });

  it('rejects a short id, a short token and a token with other characters', () => {
    expect(ShareIdParamsSchema.safeParse({ shareId: 'not-a-uuid' }).success).toBe(false);
    expect(ShareTokenParamsSchema.safeParse({ token: 'short' }).success).toBe(false);
    expect(ShareTokenParamsSchema.safeParse({ token: `${'A'.repeat(42)}=` }).success).toBe(false);
  });
});

describe('response schemas', () => {
  it('parses a link and rejects an unknown status', () => {
    expect(ShareLinkResponseSchema.parse(link)).toEqual(link);
    expect(ShareLinkResponseSchema.safeParse({ ...link, status: 'gone' }).success).toBe(false);
  });

  it('parses an active list page with the note title', () => {
    const page = {
      items: [{ ...link, noteTitle: 'Groceries' }],
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
    };
    expect(ActiveShareLinkListResponseSchema.parse(page)).toEqual(page);
  });

  it('allows only title, content and updatedAt in the public note', () => {
    const note = { title: 'T', content: EMPTY_DOC, updatedAt: AT };
    expect(PublicSharedNoteSchema.parse(note)).toEqual(note);
    expect(PublicSharedNoteSchema.safeParse({ ...note, id: ID }).success).toBe(false);
  });
});
