import { describe, expect, it } from 'vitest';
import { anglePlaceholders, escapeHighlight, highlightMarkers } from './escape-highlight.js';

const NONCE = '0123456789abcdef';
const { start, stop } = highlightMarkers(NONCE);

describe('escapeHighlight', () => {
  it('turns the nonce markers into mark tags', () => {
    expect(escapeHighlight(`a ${start}budget${stop} b`, NONCE)).toBe('a <mark>budget</mark> b');
  });

  it('escapes all five HTML characters in the note text', () => {
    expect(escapeHighlight(`<b> & "q" 'x'`, NONCE)).toBe(
      '&lt;b&gt; &amp; &quot;q&quot; &#39;x&#39;',
    );
  });

  it('escapes a literal mark tag typed by the user', () => {
    expect(escapeHighlight(`<mark>fake</mark>`, NONCE)).toBe('&lt;mark&gt;fake&lt;/mark&gt;');
  });

  it('restores the angle-bracket placeholders as escaped text', () => {
    const { open, close } = anglePlaceholders(NONCE);
    expect(escapeHighlight(`${open}script${close}`, NONCE)).toBe('&lt;script&gt;');
    expect(escapeHighlight(`a${open}b`, NONCE)).toBe('a&lt;b');
  });

  it('does not treat a forged marker with another nonce as a mark tag', () => {
    const forged = highlightMarkers('ffffffffffffffff');
    expect(escapeHighlight(`${forged.start}x${forged.stop}`, NONCE)).not.toContain('<mark>');
  });

  it('keeps the markers intact through escaping', () => {
    expect(highlightMarkers(NONCE).start).toMatch(/^[@\w/]+$/);
    expect(highlightMarkers(NONCE).stop).toMatch(/^[@\w/]+$/);
  });
});
