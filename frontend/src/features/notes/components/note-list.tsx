import type { NoteListItem } from '@note-app/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { NoteCard } from './note-card';

interface NoteListProps {
  items: NoteListItem[] | undefined;
  isLoading: boolean;
  isError: boolean;
  dimmed?: boolean;
  creating?: boolean;
  onRetry: () => void;
  onCreate: () => void;
  onDelete: (note: NoteListItem) => void;
}

export function NoteList({
  items,
  isLoading,
  isError,
  dimmed = false,
  creating = false,
  onRetry,
  onCreate,
  onDelete,
}: NoteListProps) {
  if (isLoading) {
    return (
      <div role="status" aria-label="Loading notes" className="flex flex-col gap-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }
  if (isError || !items) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 rounded-lg border p-4">
        <p>Could not load your notes.</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8">
        <p className="text-muted-foreground">No notes yet.</p>
        <Button disabled={creating} onClick={onCreate}>
          New note
        </Button>
      </div>
    );
  }
  return (
    <div className={dimmed ? 'flex flex-col gap-3 opacity-60' : 'flex flex-col gap-3'}>
      {items.map((note) => (
        <NoteCard key={note.id} note={note} onDelete={onDelete} />
      ))}
    </div>
  );
}
