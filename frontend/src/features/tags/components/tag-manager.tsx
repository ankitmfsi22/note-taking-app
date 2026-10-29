import type { TagWithCount } from '@note-app/shared';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCreateTagMutation,
  useDeleteTagMutation,
  useTagsQuery,
  useUpdateTagMutation,
} from '../queries';
import { CreateTagForm, EditTagForm } from './tag-form';

const countLabel = (count: number) => `${count} ${count === 1 ? 'note' : 'notes'}`;

export function TagManager() {
  const tags = useTagsQuery();
  const createTag = useCreateTagMutation();
  const updateTag = useUpdateTagMutation();
  const deleteTag = useDeleteTagMutation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TagWithCount | null>(null);

  const renderBody = () => {
    if (tags.isPending) {
      return (
        <div role="status" aria-label="Loading tags">
          <Skeleton className="h-8 w-full" />
        </div>
      );
    }
    if (tags.isError) {
      return (
        <div role="alert" className="flex items-center gap-3 text-sm">
          <span>Could not load your tags.</span>
          <Button variant="outline" size="sm" onClick={() => void tags.refetch()}>
            Retry
          </Button>
        </div>
      );
    }
    if (tags.data.items.length === 0) {
      return <p className="text-sm text-muted-foreground">No tags yet.</p>;
    }
    return (
      <ul className="flex flex-col gap-2">
        {tags.data.items.map((tag) => (
          <li key={tag.id} className="rounded-lg border p-3">
            {editingId === tag.id ? (
              <EditTagForm
                initial={{ name: tag.name, color: tag.color }}
                onSubmit={async (body) => {
                  await updateTag.mutateAsync({ tagId: tag.id, body });
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span
                  title={tag.color}
                  className="inline-block size-4 rounded-full border"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="font-medium break-words">{tag.name}</span>
                <span className="text-sm text-muted-foreground">{countLabel(tag.noteCount)}</span>
                <div className="ml-auto flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Edit ${tag.name}`}
                    onClick={() => setEditingId(tag.id)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete ${tag.name}`}
                    onClick={() => setPendingDelete(tag)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <section aria-labelledby="tag-manager-heading" className="flex flex-col gap-3">
      <h3 id="tag-manager-heading" className="text-lg font-semibold">
        Tags
      </h3>
      <CreateTagForm onSubmit={(body) => createTag.mutateAsync(body)} />
      {renderBody()}
      {deleteTag.isError && (
        <p role="alert" className="text-sm text-destructive">
          Could not delete the tag. Please try again.
        </p>
      )}
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this tag?"
        description={`"${pendingDelete?.name ?? ''}" is removed from all notes. The notes themselves are kept.`}
        confirmLabel="Delete tag"
        pending={deleteTag.isPending}
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteTag.mutate(pendingDelete.id, { onSettled: () => setPendingDelete(null) });
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}
