import type { NoteResponse } from '@note-app/shared';
import type { Editor, JSONContent } from '@tiptap/core';
import { useCallback, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { VersionDrawer } from '@/features/versions/components/version-drawer';
import { ApiError } from '@/lib/api-client';
import { LeaveGuard } from '../components/leave-guard';
import { NoteEditor } from '../components/note-editor';
import { NoteNotFound } from '../components/note-not-found';
import { SaveStatus } from '../components/save-status';
import { TagPicker } from '../components/tag-picker';
import { TitleField } from '../components/title-field';
import { useNoteQuery } from '../queries';
import { useEditorSaveStore } from '../save-store';
import { useAutosave } from '../use-autosave';

function NoteEditorView({ note }: { note: NoteResponse }) {
  const [title, setTitle] = useState(note.title);
  const titleRef = useRef(note.title);
  const editorRef = useRef<Editor | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const titleError = useEditorSaveStore((state) => state.fieldErrors['title']);

  const markDirty = useAutosave({
    noteId: note.id,
    getDraft: () =>
      editorRef.current ? { title: titleRef.current, content: editorRef.current.getJSON() } : null,
  });

  const onTitleChange = (value: string) => {
    titleRef.current = value;
    setTitle(value);
    markDirty();
  };

  const onEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  // The restored note replaces the draft. No update event: nothing is unsaved, so autosave must
  // not send the restored content again as a new edit.
  const onRestored = (restored: NoteResponse) => {
    titleRef.current = restored.title;
    setTitle(restored.title);
    editorRef.current?.commands.setContent(restored.content as JSONContent, { emitUpdate: false });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/notes" className="text-sm text-muted-foreground underline">
          Back to notes
        </Link>
        <div className="flex items-center gap-2">
          <SaveStatus />
          {/* Share is enabled by AB-1014 (sharing). */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            title="Sharing is not available yet"
          >
            Share
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
            Version history
          </Button>
        </div>
      </div>
      <LeaveGuard />
      <TitleField value={title} error={titleError} onChange={onTitleChange} />
      <TagPicker noteId={note.id} tags={note.tags} />
      <NoteEditor content={note.content} onChange={markDirty} onEditorReady={onEditorReady} />
      {historyOpen && (
        <VersionDrawer
          noteId={note.id}
          latestVersion={note.latestVersion}
          open
          onOpenChange={setHistoryOpen}
          onRestored={onRestored}
        />
      )}
    </div>
  );
}

export function Component() {
  const { noteId = '' } = useParams();
  const query = useNoteQuery(noteId);

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) return <NoteNotFound />;
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p>The note could not be loaded.</p>
        <Button type="button" variant="outline" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  return <NoteEditorView key={query.data.id} note={query.data} />;
}
