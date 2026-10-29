import { describe, expect, it } from 'vitest';
import { parseHighlight } from './highlight';

describe('parseHighlight', () => {
  it('S-AB1013-02: decodes the five entities and honours only the exact mark tokens', () => {
    expect(
      parseHighlight(
        '&lt;script&gt;alert(1)&lt;/script&gt; <mark>plan</mark> &amp; &quot;q&quot; &#39;x&#39; &lt;mark&gt;fake&lt;/mark&gt;',
      ),
    ).toEqual([
      { text: '<script>alert(1)</script> ', highlighted: false },
      { text: 'plan', highlighted: true },
      { text: ' & "q" \'x\' <mark>fake</mark>', highlighted: false },
    ]);
  });

  it('S-AB1013-02: unbalanced and nested-looking input never throws and yields only text', () => {
    expect(parseHighlight('a</mark>b')).toEqual([
      { text: 'a', highlighted: false },
      { text: 'b', highlighted: false },
    ]);
    expect(parseHighlight('<mark>a')).toEqual([{ text: 'a', highlighted: true }]);
    expect(parseHighlight('<mark><mark>a</mark></mark>b')).toEqual([
      { text: 'a', highlighted: true },
      { text: 'b', highlighted: false },
    ]);
    expect(parseHighlight('')).toEqual([]);
  });

  it('decodes once, so a double-escaped entity stays literal', () => {
    expect(parseHighlight('&amp;lt;')).toEqual([{ text: '&lt;', highlighted: false }]);
  });
});
