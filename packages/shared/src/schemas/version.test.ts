import { describe, expect, it } from 'vitest';
import { EMPTY_DOC } from './tiptap.js';
import {
  VersionDetailSchema,
  VersionListItemSchema,
  VersionListResponseSchema,
  VersionParamsSchema,
} from './version.js';

const ID = '0190b0a0-0000-7000-8000-000000000001';
const AT = '2026-10-29T10:00:00.000Z';

describe('VersionParamsSchema', () => {
  it('coerces the version number from the path', () => {
    expect(VersionParamsSchema.parse({ noteId: ID, versionNumber: '3' })).toEqual({
      noteId: ID,
      versionNumber: 3,
    });
  });

  it('rejects zero, text, fractions and a bad note id', () => {
    for (const versionNumber of ['0', 'abc', '1.5']) {
      expect(VersionParamsSchema.safeParse({ noteId: ID, versionNumber }).success).toBe(false);
    }
    expect(VersionParamsSchema.safeParse({ noteId: 'x', versionNumber: '1' }).success).toBe(false);
  });
});

describe('version responses', () => {
  it('lists versions without content', () => {
    const item = { versionNumber: 2, title: 't', createdAt: AT };
    expect(VersionListItemSchema.parse({ ...item, content: EMPTY_DOC })).toEqual(item);
    const page = { items: [item], page: 1, pageSize: 20, total: 1, totalPages: 1 };
    expect(VersionListResponseSchema.safeParse(page).success).toBe(true);
  });

  it('returns the full content in the detail and rejects a version below 1', () => {
    const detail = { versionNumber: 1, title: 't', content: EMPTY_DOC, createdAt: AT };
    expect(VersionDetailSchema.parse(detail)).toEqual(detail);
    expect(VersionDetailSchema.safeParse({ ...detail, versionNumber: 0 }).success).toBe(false);
  });
});
