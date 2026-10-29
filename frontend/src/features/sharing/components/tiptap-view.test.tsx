import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TiptapView } from './tiptap-view';

describe('TiptapView', () => {
  it('renders every allow-listed node and mark as elements', () => {
    const { container } = render(
      <TiptapView
        doc={{
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'H1' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'H2' }] },
            { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'H3' }] },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'styled',
                  marks: [
                    { type: 'bold' },
                    { type: 'italic' },
                    { type: 'strike' },
                    { type: 'code' },
                  ],
                },
                { type: 'hardBreak' },
                {
                  type: 'text',
                  text: 'site',
                  marks: [{ type: 'link', attrs: { href: 'https://example.com/' } }],
                },
              ],
            },
            { type: 'codeBlock', content: [{ type: 'text', text: 'let a = 1' }] },
            {
              type: 'blockquote',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'quote' }] }],
            },
            {
              type: 'bulletList',
              content: [
                {
                  type: 'listItem',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }],
                },
              ],
            },
            {
              type: 'orderedList',
              attrs: { start: 3 },
              content: [
                {
                  type: 'listItem',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'three' }] }],
                },
              ],
            },
            { type: 'unknown' },
          ],
        }}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'H1' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
    expect(container.querySelector('code > s > em > strong')).toHaveTextContent('styled');
    expect(container.querySelector('br')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'site' })).toHaveAttribute(
      'href',
      'https://example.com/',
    );
    expect(container.querySelector('pre > code')).toHaveTextContent('let a = 1');
    expect(container.querySelector('blockquote')).toHaveTextContent('quote');
    expect(container.querySelector('ul > li')).toHaveTextContent('one');
    expect(container.querySelector('ol')).toHaveAttribute('start', '3');
  });

  it('drops unsafe and malformed links and renders empty documents', () => {
    const { container } = render(
      <TiptapView
        doc={{
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'bad',
                  marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
                },
                { type: 'text', text: 'rel', marks: [{ type: 'link', attrs: { href: 'nope' } }] },
                { type: 'text', text: 'num', marks: [{ type: 'link', attrs: { href: 5 } }] },
                { type: 'text', text: 'odd', marks: [{ type: 'wavy' }] },
              ],
            },
            { type: 'paragraph' },
            { type: 'orderedList', content: [{ type: 'listItem' }] },
          ],
        }}
      />,
    );
    expect(container.querySelector('a')).toBeNull();
    expect(container).toHaveTextContent('badrelnumodd');
    expect(container.querySelector('ol')).toHaveAttribute('start', '1');
  });

  it('renders text containing markup as literal text', () => {
    const { container } = render(
      <TiptapView
        doc={{
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '<script>x</script>' }] }],
        }}
      />,
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container).toHaveTextContent('<script>x</script>');
  });

  it('renders text without a text field as empty', () => {
    const { container } = render(
      <TiptapView
        doc={{ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text' }] }] }}
      />,
    );
    expect(container.querySelector('p')).toBeEmptyDOMElement();
  });
});
