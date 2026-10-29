import type { TipTapDoc } from '@note-app/shared';
import type { JSONContent } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import { editorExtensions } from '@/features/editor/extensions';

interface VersionPreviewProps {
  content: TipTapDoc;
}

// Read-only TipTap view: the document is rendered by the editor, never as HTML strings.
// Mount it with a `key` per version, because the content is read once.
export function VersionPreview({ content }: VersionPreviewProps) {
  const editor = useEditor({
    extensions: editorExtensions,
    content: content as JSONContent,
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        'aria-label': 'Version content',
        class:
          'rounded-md border px-3 py-2 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_code]:font-mono [&_a]:text-primary [&_a]:underline',
      },
    },
  });
  if (!editor) return null;
  return <EditorContent editor={editor} />;
}
