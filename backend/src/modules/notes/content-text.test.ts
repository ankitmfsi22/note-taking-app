import { describe, expect, it } from 'vitest';
import { contentTextOf, previewOf } from './content-text.js';

describe('contentTextOf', () => {
  it('joins text nodes and ends every block and hard break with a newline', () => {
    expect(
      contentTextOf({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'one' },
              { type: 'hardBreak' },
              { type: 'text', text: 'two' },
            ],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'item' }] }],
              },
            ],
          },
        ],
      }),
    ).toBe('one\ntwo\nitem\n\n\n');
  });

  it('returns an empty string for a doc without content', () => {
    expect(contentTextOf({ type: 'doc' })).toBe('');
  });
});

describe('previewOf', () => {
  it('collapses whitespace and keeps the first 150 characters', () => {
    expect(previewOf('  a\n\n b\t c ')).toBe('a b c');
    expect(previewOf('x'.repeat(200))).toHaveLength(150);
  });
});
