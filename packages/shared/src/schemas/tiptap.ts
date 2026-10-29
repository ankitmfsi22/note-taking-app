import { z } from 'zod';
import { CONTENT_MAX_BYTES, TIPTAP_MAX_DEPTH } from '../constants/limits.js';

// Allow-list grammar of SDS 8.1. Every object is strict, so unknown node types, marks and
// attribute keys are rejected.

const LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

const isSafeHref = (href: string): boolean => {
  try {
    return LINK_PROTOCOLS.has(new URL(href).protocol);
  } catch {
    return false;
  }
};

const optionalString = z.string().nullable().optional();

const SimpleMarkSchema = z.strictObject({ type: z.enum(['bold', 'italic', 'strike', 'code']) });

const LinkMarkSchema = z.strictObject({
  type: z.literal('link'),
  attrs: z.strictObject({
    href: z.string().refine(isSafeHref, 'Link must be an http, https or mailto URL'),
    target: optionalString,
    rel: optionalString,
    class: optionalString,
  }),
});

const MarkSchema = z.union([SimpleMarkSchema, LinkMarkSchema]);

const TextNodeSchema = z.strictObject({
  type: z.literal('text'),
  text: z.string(),
  marks: z.array(MarkSchema).optional(),
});

const HardBreakNodeSchema = z.strictObject({
  type: z.literal('hardBreak'),
  marks: z.array(MarkSchema).optional(),
});

const InlineNodeSchema = z.union([TextNodeSchema, HardBreakNodeSchema]);

const ParagraphNodeSchema = z.strictObject({
  type: z.literal('paragraph'),
  content: z.array(InlineNodeSchema).optional(),
});

const HeadingNodeSchema = z.strictObject({
  type: z.literal('heading'),
  attrs: z.strictObject({ level: z.union([z.literal(1), z.literal(2), z.literal(3)]) }),
  content: z.array(InlineNodeSchema).optional(),
});

const CodeBlockNodeSchema = z.strictObject({
  type: z.literal('codeBlock'),
  attrs: z.strictObject({ language: optionalString }).optional(),
  content: z.array(TextNodeSchema).optional(),
});

const ListItemNodeSchema = z.strictObject({
  type: z.literal('listItem'),
  get content(): z.ZodOptional<z.ZodArray<typeof BlockNodeSchema>> {
    return z.array(BlockNodeSchema).optional();
  },
});

const BlockquoteNodeSchema = z.strictObject({
  type: z.literal('blockquote'),
  get content(): z.ZodOptional<z.ZodArray<typeof BlockNodeSchema>> {
    return z.array(BlockNodeSchema).optional();
  },
});

const BulletListNodeSchema = z.strictObject({
  type: z.literal('bulletList'),
  content: z.array(ListItemNodeSchema).optional(),
});

const OrderedListNodeSchema = z.strictObject({
  type: z.literal('orderedList'),
  attrs: z.strictObject({ start: z.int().min(1).optional() }).optional(),
  content: z.array(ListItemNodeSchema).optional(),
});

// Exported so declaration files can name the recursive type instead of eliding it to `any`.
export const BlockNodeSchema = z.union([
  ParagraphNodeSchema,
  HeadingNodeSchema,
  CodeBlockNodeSchema,
  BlockquoteNodeSchema,
  BulletListNodeSchema,
  OrderedListNodeSchema,
]);

export const DocNodeSchema = z.strictObject({
  type: z.literal('doc'),
  content: z.array(BlockNodeSchema).optional(),
});

// Iterative, so a hostile body nested thousands of levels deep cannot overflow the stack.
const exceedsDepth = (root: unknown, max: number): boolean => {
  const stack: { node: unknown; depth: number }[] = [{ node: root, depth: 1 }];
  while (stack.length > 0) {
    const { node, depth } = stack.pop() as { node: unknown; depth: number };
    if (depth > max) return true;
    if (typeof node !== 'object' || node === null || !('content' in node)) continue;
    const { content } = node;
    if (!Array.isArray(content)) continue;
    for (const child of content as unknown[]) stack.push({ node: child, depth: depth + 1 });
  }
  return false;
};

const byteLength = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).length;

// Depth and size run first; any issue stops the pipe, so the recursive grammar only ever sees a
// bounded document.
export const TipTapDocSchema = z
  .unknown()
  .superRefine((value, ctx) => {
    if (exceedsDepth(value, TIPTAP_MAX_DEPTH)) {
      ctx.addIssue({ code: 'custom', message: `Content nesting exceeds ${TIPTAP_MAX_DEPTH}` });
    } else if (byteLength(value) > CONTENT_MAX_BYTES) {
      ctx.addIssue({ code: 'custom', message: `Content exceeds ${CONTENT_MAX_BYTES} bytes` });
    }
  })
  .pipe(DocNodeSchema);

// What an empty TipTap editor produces. Callers copy it, never mutate it.
export const EMPTY_DOC: z.output<typeof DocNodeSchema> = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};
