import { TipTapDocSchema, type TipTapDoc } from '@note-app/shared';
import type { JSONContent } from '@tiptap/core';

// TipTap 3.32 emits attributes the strict TipTapDocSchema rejects (`type` on orderedList, `title`
// on link). The schema is the contract (SDS 8.1), so the editor output is trimmed to the keys the
// schema names before it is sent. The spike of AB-1012 task 2.1 found exactly these two.
const ALLOWED_ATTRS: Record<string, readonly string[]> = {
  heading: ['level'],
  codeBlock: ['language'],
  orderedList: ['start'],
  link: ['href', 'target', 'rel', 'class'],
};

const cleanAttrs = (type: string, attrs: Record<string, unknown>) => {
  const keys = ALLOWED_ATTRS[type] ?? [];
  const entries = Object.entries(attrs).filter(
    ([key, value]) =>
      keys.includes(key) && value !== undefined && !(key === 'start' && value === null),
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const clean = (node: JSONContent): JSONContent => {
  const { type, attrs, content, marks, text } = node;
  const kind = type ?? '';
  const result: JSONContent = { type: kind };
  const cleaned = attrs ? cleanAttrs(kind, attrs) : undefined;
  if (cleaned) result.attrs = cleaned;
  if (marks) result.marks = marks.map((mark) => clean(mark) as { type: string });
  if (text !== undefined) result.text = text;
  if (content) result.content = content.map(clean);
  return result;
};

// Throws a ZodError if the document is still outside the allow-list; the autosaver reports that
// as a failed save instead of sending it.
export const toSavedDoc = (json: JSONContent): TipTapDoc => TipTapDocSchema.parse(clean(json));
