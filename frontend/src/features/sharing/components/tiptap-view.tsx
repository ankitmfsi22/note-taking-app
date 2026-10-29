import type { ReactNode } from 'react';

// Renders TipTap JSON as React elements. The doc was parsed with TipTapDocSchema, but the
// renderer still allow-lists node types, marks and URL schemes itself and never emits HTML.
interface Mark {
  type: string;
  attrs?: { href?: unknown } | undefined;
}
interface TNode {
  type: string;
  text?: string | undefined;
  marks?: Mark[] | undefined;
  attrs?: Record<string, unknown> | undefined;
  content?: TNode[] | undefined;
}

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

const safeHref = (href: unknown): string | null => {
  if (typeof href !== 'string') return null;
  try {
    return SAFE_PROTOCOLS.has(new URL(href).protocol) ? href : null;
  } catch {
    return null;
  }
};

const applyMark = (child: ReactNode, mark: Mark, key: string): ReactNode => {
  switch (mark.type) {
    case 'bold':
      return <strong key={key}>{child}</strong>;
    case 'italic':
      return <em key={key}>{child}</em>;
    case 'strike':
      return <s key={key}>{child}</s>;
    case 'code':
      return <code key={key}>{child}</code>;
    case 'link': {
      const href = safeHref(mark.attrs?.href);
      return href ? (
        <a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow">
          {child}
        </a>
      ) : (
        child
      );
    }
    default:
      return child;
  }
};

const renderChildren = (nodes: TNode[] | undefined, path: string): ReactNode[] =>
  (nodes ?? []).map((node, index) => renderNode(node, `${path}.${index}`));

const renderNode = (node: TNode, key: string): ReactNode => {
  switch (node.type) {
    case 'text': {
      const marks = node.marks ?? [];
      return marks.reduce<ReactNode>(
        (child, mark, index) => applyMark(child, mark, `${key}.m${index}`),
        node.text ?? '',
      );
    }
    case 'hardBreak':
      return <br key={key} />;
    case 'paragraph':
      return <p key={key}>{renderChildren(node.content, key)}</p>;
    case 'heading': {
      const children = renderChildren(node.content, key);
      if (node.attrs?.['level'] === 1) return <h1 key={key}>{children}</h1>;
      if (node.attrs?.['level'] === 2) return <h2 key={key}>{children}</h2>;
      return <h3 key={key}>{children}</h3>;
    }
    case 'codeBlock':
      return (
        <pre key={key}>
          <code>{renderChildren(node.content, key)}</code>
        </pre>
      );
    case 'blockquote':
      return <blockquote key={key}>{renderChildren(node.content, key)}</blockquote>;
    case 'bulletList':
      return <ul key={key}>{renderChildren(node.content, key)}</ul>;
    case 'orderedList':
      return (
        <ol key={key} start={typeof node.attrs?.['start'] === 'number' ? node.attrs['start'] : 1}>
          {renderChildren(node.content, key)}
        </ol>
      );
    case 'listItem':
      return <li key={key}>{renderChildren(node.content, key)}</li>;
    default:
      return null;
  }
};

export function TiptapView({ doc }: { doc: TNode }) {
  return <div className="space-y-3 break-words">{renderChildren(doc.content, 'n')}</div>;
}
