import type { NoteResponse } from '@note-app/shared';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api-client';
import { useRestoreVersion, useVersionQuery, useVersionsQuery } from '../queries';
import { VersionPreview } from './version-preview';

interface VersionDrawerProps {
  noteId: string;
  // The note's newest version; restoring it would change nothing.
  latestVersion: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Receives the restored note so the editor can show it.
  onRestored: (note: NoteResponse) => void;
}

const ALREADY_CURRENT = 'This is already the current version.';

const formatTime = (iso: string) => new Date(iso).toLocaleString();

const restoreErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError && error.code === 'VERSION_ALREADY_CURRENT') return ALREADY_CURRENT;
  if (error instanceof Error) return error.message;
  return 'The version could not be restored.';
};

export function VersionDrawer({
  noteId,
  latestVersion,
  open,
  onOpenChange,
  onRestored,
}: VersionDrawerProps) {
  const versions = useVersionsQuery(noteId);
  const [selected, setSelected] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const detail = useVersionQuery(noteId, selected);
  const restore = useRestoreVersion(noteId);

  const items = versions.data?.pages.flatMap((page) => page.items) ?? [];
  const isLatest = selected !== null && selected >= latestVersion;

  const select = (versionNumber: number) => {
    setSelected(versionNumber);
    setNotice(null);
    restore.reset();
  };

  const confirmRestore = () => {
    if (selected === null) return;
    const from = selected;
    setConfirming(false);
    restore.mutate(from, {
      onSuccess: (note) => {
        setSelected(null);
        setNotice(`Version ${from} was restored as version ${note.latestVersion}.`);
        onRestored(note);
      },
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Version history</SheetTitle>
          <SheetDescription>
            Browse earlier versions of this note. Restoring one saves it as a new version.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 p-4">
          {notice && (
            <p role="status" className="text-sm text-muted-foreground">
              {notice}
            </p>
          )}
          {versions.isPending ? (
            <div role="status" aria-busy="true" className="flex flex-col gap-2">
              <span className="text-sm text-muted-foreground">Loading versions...</span>
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : versions.isError ? (
            <div role="alert" className="flex flex-col items-start gap-2">
              <p>{restoreErrorMessage(versions.error)}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void versions.refetch()}
              >
                Try again
              </Button>
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No versions yet.</p>
          ) : (
            <>
              <ul aria-label="Versions" className="flex flex-col gap-1">
                {items.map((item) => (
                  <li key={item.versionNumber}>
                    <Button
                      type="button"
                      variant={selected === item.versionNumber ? 'secondary' : 'ghost'}
                      className="w-full justify-between"
                      aria-pressed={selected === item.versionNumber}
                      onClick={() => select(item.versionNumber)}
                    >
                      <span>Version {item.versionNumber}</span>
                      <time dateTime={item.createdAt} className="text-muted-foreground">
                        {formatTime(item.createdAt)}
                      </time>
                    </Button>
                  </li>
                ))}
              </ul>
              {versions.hasNextPage && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={versions.isFetchingNextPage}
                  onClick={() => void versions.fetchNextPage()}
                >
                  Load more
                </Button>
              )}
            </>
          )}

          {selected !== null && (
            <section
              aria-label={`Version ${selected}`}
              className="flex flex-col gap-3 border-t pt-4"
            >
              {detail.isPending ? (
                <div role="status" aria-busy="true">
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : detail.isError ? (
                <p role="alert">{restoreErrorMessage(detail.error)}</p>
              ) : (
                <>
                  <h3 className="text-lg font-semibold">{detail.data.title}</h3>
                  <VersionPreview key={detail.data.versionNumber} content={detail.data.content} />
                  <div className="flex flex-col items-start gap-2">
                    <Button
                      type="button"
                      disabled={isLatest || restore.isPending}
                      onClick={() => setConfirming(true)}
                    >
                      Restore this version
                    </Button>
                    {isLatest && <p className="text-sm text-muted-foreground">{ALREADY_CURRENT}</p>}
                  </div>
                </>
              )}
            </section>
          )}
          {restore.isError && (
            <p role="alert" className="text-sm text-destructive">
              {restoreErrorMessage(restore.error)}
            </p>
          )}
        </div>
      </SheetContent>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore version {selected}?</AlertDialogTitle>
            <AlertDialogDescription>
              Your unsaved edits are saved first. The note then becomes a copy of this version, as a
              new version.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
