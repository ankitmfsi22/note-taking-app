import { TRASH_RETENTION_DAYS, type NoteListItem } from '@note-app/shared';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Pager } from '@/components/pager';
import { Button } from '@/components/ui/button';
import { SearchSection } from '@/features/search/components/search-section';
import { TagManager } from '@/features/tags/components/tag-manager';
import { useTagsQuery } from '@/features/tags/queries';
import { useDocumentMeta } from '@/lib/use-document-meta';
import { ListToolbar } from '../components/list-toolbar';
import { NoteList } from '../components/note-list';
import { parseListParams, toSearchParams, type ListParams } from '../list-params';
import { useCreateNoteMutation, useDeleteNoteMutation, useNotesQuery } from '../queries';

function NotesList() {
  useDocumentMeta({
    title: 'Your notes',
    description: 'Browse, sort, tag and search your notes.',
    noindex: true,
  });
  const [searchParams, setSearchParams] = useSearchParams();
  // The URL is the only copy of page, sort and tag filter (AC-FELIST-03).
  const params = parseListParams(searchParams);
  const navigate = useNavigate();
  const notes = useNotesQuery(params);
  const tags = useTagsQuery();
  const createNote = useCreateNoteMutation();
  const deleteNote = useDeleteNoteMutation();
  const [pendingDelete, setPendingDelete] = useState<NoteListItem | null>(null);

  const update = (next: Partial<ListParams>) =>
    setSearchParams(toSearchParams({ ...params, ...next }));
  // A new sort or filter starts again from page 1.
  const changeView = (next: Partial<Pick<ListParams, 'sortBy' | 'sortOrder' | 'tagIds'>>) =>
    update({ ...next, page: 1 });

  const create = () =>
    createNote.mutate(undefined, { onSuccess: (note) => void navigate(`/notes/${note.id}`) });

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteNote.mutate(pendingDelete.id, { onSettled: () => setPendingDelete(null) });
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Your notes</h1>
        <div className="flex items-center gap-3">
          <Link
            to="/notes/trash"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Trash
          </Link>
          <Button disabled={createNote.isPending} onClick={create}>
            New note
          </Button>
        </div>
      </div>

      {(createNote.isError || deleteNote.isError) && (
        <p role="alert" className="text-sm text-destructive">
          {createNote.isError
            ? 'Could not create the note. Please try again.'
            : 'Could not delete the note. Please try again.'}
        </p>
      )}

      <ListToolbar
        params={params}
        tags={tags.data?.items ?? []}
        tagsLoading={tags.isPending}
        onChange={changeView}
      />

      <NoteList
        items={notes.data?.items}
        isLoading={notes.isPending}
        isError={notes.isError}
        dimmed={notes.isPlaceholderData}
        creating={createNote.isPending}
        onRetry={() => void notes.refetch()}
        onCreate={create}
        onDelete={setPendingDelete}
      />

      {notes.data && (
        <Pager
          page={params.page}
          totalPages={notes.data.totalPages}
          onPageChange={(page) => update({ page })}
        />
      )}

      {/* Mounted once the list has settled: it sits below the list, so showing it next to the
          loading skeleton would push it down when the notes arrive (layout shift). */}
      {!notes.isPending && <TagManager />}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this note?"
        description={`"${pendingDelete?.title ?? ''}" moves to Trash. You can restore it from Trash for ${TRASH_RETENTION_DAYS} days.`}
        confirmLabel="Delete note"
        pending={deleteNote.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}

// The search box mounts above the list (AB-1013); the list unmounts while a search is active.
export function Component() {
  return (
    <SearchSection>
      <NotesList />
    </SearchSection>
  );
}
