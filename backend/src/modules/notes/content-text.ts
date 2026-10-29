import { PREVIEW_MAX, type TipTapDoc } from '@note-app/shared';

const INLINE_TYPES = new Set(['doc', 'text', 'hardBreak']);

interface Node {
  type: string;
  text?: string | undefined;
  content?: readonly Node[] | undefined;
}

// SDS 8.1: depth-first, text as is, a newline after each block and for each hard break. The schema
// caps depth at 20, so recursion is safe here.
const walk = (node: Node, out: string[]): void => {
  if (node.type === 'text') out.push(node.text ?? '');
  if (node.type === 'hardBreak') out.push('\n');
  for (const child of node.content ?? []) walk(child, out);
  if (!INLINE_TYPES.has(node.type)) out.push('\n');
};

export const contentTextOf = (doc: TipTapDoc): string => {
  const out: string[] = [];
  walk(doc, out);
  return out.join('');
};

// FRS A-38: whitespace collapsed, first 150 characters.
export const previewOf = (contentText: string): string =>
  contentText.replace(/\s+/g, ' ').trim().slice(0, PREVIEW_MAX);
