import { describe, expect, it } from 'vitest';
import { uuid } from '@/test/fixtures';
import { parseListParams, toSearchParams } from './list-params';

describe('parseListParams', () => {
  it('returns the defaults for an empty query', () => {
    expect(parseListParams(new URLSearchParams())).toEqual({
      page: 1,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      tagIds: [],
    });
  });

  it('reads valid values', () => {
    const query = `page=2&sortBy=title&sortOrder=asc&tagIds=${uuid(1)},${uuid(2)}`;
    expect(parseListParams(new URLSearchParams(query))).toEqual({
      page: 2,
      sortBy: 'title',
      sortOrder: 'asc',
      tagIds: [uuid(1), uuid(2)],
    });
  });

  it('falls back field by field for invalid values', () => {
    const query = `page=abc&sortBy=bogus&sortOrder=asc&tagIds=nope`;
    expect(parseListParams(new URLSearchParams(query))).toEqual({
      page: 1,
      sortBy: 'updatedAt',
      sortOrder: 'asc',
      tagIds: [],
    });
  });
});

describe('toSearchParams', () => {
  it('omits defaults and writes the rest', () => {
    expect(
      toSearchParams({ page: 1, sortBy: 'updatedAt', sortOrder: 'desc', tagIds: [] }).toString(),
    ).toBe('');
    const written = toSearchParams({
      page: 3,
      sortBy: 'title',
      sortOrder: 'asc',
      tagIds: [uuid(1), uuid(2)],
    });
    expect(written.get('page')).toBe('3');
    expect(written.get('sortBy')).toBe('title');
    expect(written.get('sortOrder')).toBe('asc');
    expect(written.get('tagIds')).toBe(`${uuid(1)},${uuid(2)}`);
  });
});
