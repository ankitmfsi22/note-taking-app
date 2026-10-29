import { describe, expect, it } from 'vitest';
import { CONTENT_MAX_BYTES, TIPTAP_MAX_DEPTH } from '../constants/limits.js';
import { EMPTY_DOC, TipTapDocSchema } from './tiptap.js';

const doc = (...content: unknown[]) => ({ type: 'doc', content });
const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const accepts = (value: unknown) => TipTapDocSchema.safeParse(value).success;

// A doc whose nesting depth is `depth` (the doc itself counts as 1).
const nested = (depth: number) => {
  let node: object = { type: 'paragraph' };
  for (let level = 2; level < depth; level += 1) node = { type: 'blockquote', content: [node] };
  return doc(node);
};

describe('TipTapDocSchema', () => {
  it('accepts the empty doc and every allowed node and mark', () => {
    expect(accepts(EMPTY_DOC)).toBe(true);
    expect(
      accepts(
        doc(
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'bold', marks: [{ type: 'bold' }, { type: 'italic' }] },
              { type: 'hardBreak' },
              { type: 'text', text: 's', marks: [{ type: 'strike' }, { type: 'code' }] },
              {
                type: 'text',
                text: 'link',
                marks: [
                  {
                    type: 'link',
                    attrs: {
                      href: 'https://example.com',
                      target: '_blank',
                      rel: null,
                      class: null,
                    },
                  },
                ],
              },
            ],
          },
          { type: 'blockquote', content: [paragraph('quote')] },
          { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph('a')] }] },
          {
            type: 'orderedList',
            attrs: { start: 3 },
            content: [{ type: 'listItem', content: [paragraph('b')] }],
          },
          {
            type: 'codeBlock',
            attrs: { language: null },
            content: [{ type: 'text', text: 'x = 1' }],
          },
        ),
      ),
    ).toBe(true);
  });

  it('rejects a root that is not a doc', () => {
    expect(accepts({ type: 'paragraph' })).toBe(false);
    expect(accepts('doc')).toBe(false);
  });

  it('rejects an unknown node type', () => {
    expect(accepts(doc({ type: 'image', attrs: { src: 'x' } }))).toBe(false);
  });

  it('rejects an unknown attribute key', () => {
    expect(accepts(doc({ type: 'paragraph', attrs: { style: 'color:red' } }))).toBe(false);
  });

  it('rejects a heading level outside 1 to 3', () => {
    expect(accepts(doc({ type: 'heading', attrs: { level: 4 } }))).toBe(false);
  });

  it('rejects an ordered list start below 1', () => {
    expect(accepts(doc({ type: 'orderedList', attrs: { start: 0 } }))).toBe(false);
  });

  it('rejects a link with a javascript: or unparsable href', () => {
    const withHref = (href: string) =>
      doc({
        type: 'paragraph',
        content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href } }] }],
      });
    expect(accepts(withHref('mailto:ada@example.com'))).toBe(true);
    expect(accepts(withHref('javascript:alert(1)'))).toBe(false);
    expect(accepts(withHref('not a url'))).toBe(false);
  });

  it('accepts the maximum depth and rejects one level more', () => {
    expect(accepts(nested(TIPTAP_MAX_DEPTH))).toBe(true);
    expect(accepts(nested(TIPTAP_MAX_DEPTH + 1))).toBe(false);
  });

  it('rejects a deeply nested body without overflowing the stack', () => {
    expect(accepts(nested(50_000))).toBe(false);
  });

  it('rejects content over the byte limit', () => {
    const overhead = JSON.stringify(doc(paragraph(''))).length;
    expect(accepts(doc(paragraph('a'.repeat(CONTENT_MAX_BYTES - overhead))))).toBe(true);
    expect(accepts(doc(paragraph('a'.repeat(CONTENT_MAX_BYTES - overhead + 1))))).toBe(false);
  });
});
