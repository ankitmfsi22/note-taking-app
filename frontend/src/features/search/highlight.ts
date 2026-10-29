export interface HighlightSegment {
  text: string;
  highlighted: boolean;
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

// One pass, so "&amp;lt;" becomes the text "&lt;" and not "<".
const decode = (text: string): string =>
  text.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity);

// The server escapes the text and adds only <mark> and </mark> (SDS 8.2). Anything else, including
// an escaped "&lt;mark&gt;", stays literal text. The result is rendered as React text nodes.
export const parseHighlight = (text: string): HighlightSegment[] => {
  const segments: HighlightSegment[] = [];
  let highlighted = false;
  for (const part of text.split(/(<\/?mark>)/)) {
    if (part === '<mark>') highlighted = true;
    else if (part === '</mark>') highlighted = false;
    else if (part !== '') segments.push({ text: decode(part), highlighted });
  }
  return segments;
};
