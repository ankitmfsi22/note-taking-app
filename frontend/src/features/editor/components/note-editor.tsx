import type { TipTapDoc } from '@note-app/shared';
import type { Editor, JSONContent } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect } from 'react';
import { editorExtensions } from '../extensions';
import { EditorToolbar } from './editor-toolbar';

interface NoteEditorProps {
  // Read once when the editor is created; a response never replaces what the user is typing.
  content: TipTapDoc;
  onChange: () => void;
  onEditorReady?: (editor: Editor) => void;
}

export function NoteEditor({ content, onChange, onEditorReady }: NoteEditorProps) {
  const editor = useEditor({
    extensions: editorExtensions,
    // The schema type and TipTap's JSONContent differ only in optionality under exactOptionalPropertyTypes.
    content: content as JSONContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        'aria-label': 'Note content',
        class:
          'min-h-64 rounded-md border px-3 py-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_code]:font-mono [&_a]:text-primary [&_a]:underline',
      },
    },
    onUpdate: () => onChange(),
  });

  useEffect(() => {
    if (editor) onEditorReady?.(editor);
  }, [editor, onEditorReady]);

  if (!editor) return null;

  return (
    <div className="flex flex-col gap-2">
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
