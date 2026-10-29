import { Link, useSearchParams } from 'react-router';
import { Pager } from '@/components/pager';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api-client';
import { formatDate } from '@/lib/format-date';
import { daysRemaining } from '../days-remaining';
import { useRestoreNoteMutation, useTrashQuery } from '../queries';

const NOT_RESTORABLE =
  'This note can no longer be restored. It may have been deleted more than 30 days ago.';

const parsePage = (raw: string | null) => {
  const page = Number(raw);
  return Number.isInteger(page) && page >= 1 ? page : 1;
};

export function Component() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePage(searchParams.get('page'));
  const trash = useTrashQuery(page);
  const restore = useRestoreNoteMutation();
  const now = new Date();

  const restoreError = () => {
    if (!restore.isError) return null;
    const message =
      restore.error instanceof ApiError && restore.error.code === 'NOTE_NOT_FOUND'
        ? NOT_RESTORABLE
        : 'Could not restore the note. Please try again.';
    return (
      <p role="alert" className="text-sm text-destructive">
        {message}
      </p>
    );
  };

  const renderBody = () => {
    if (trash.isPending) {
      return (
        <div role="status" aria-label="Loading trash" className="flex flex-col gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      );
    }
    if (trash.isError) {
      return (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-lg border p-4">
          <p>Could not load the trash.</p>
          <Button variant="outline" size="sm" onClick={() => void trash.refetch()}>
            Retry
          </Button>
        </div>
      );
    }
    if (trash.data.items.length === 0) {
      return <p className="text-muted-foreground">Trash is empty.</p>;
    }
    return (
      <ul
        className={
          trash.isPlaceholderData ? 'flex flex-col gap-3 opacity-60' : 'flex flex-col gap-3'
        }
      >
        {trash.data.items.map((item) => {
          const days = daysRemaining(item.deletedAt, now);
          return (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border p-4"
            >
              <div className="flex flex-col gap-1">
                <span className="font-medium break-words">{item.title}</span>
                <span className="text-xs text-muted-foreground">
                  Deleted {formatDate(item.deletedAt)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {`${days} ${days === 1 ? 'day' : 'days'} left`}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                aria-label={`Restore ${item.title}`}
                disabled={restore.isPending}
                onClick={() => restore.mutate(item.id)}
              >
                Restore
              </Button>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Trash</h2>
        <Link to="/notes" className="text-sm text-primary underline-offset-4 hover:underline">
          Back to notes
        </Link>
      </div>
      {restoreError()}
      {renderBody()}
      {trash.data && (
        <Pager
          page={page}
          totalPages={trash.data.totalPages}
          onPageChange={(next) => setSearchParams(next === 1 ? {} : { page: String(next) })}
        />
      )}
    </section>
  );
}
