import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { useActiveShares } from '../queries';
import { useState } from 'react';
import { ShareLinkRow } from '../components/share-link-row';

// The page number lives in the URL like the notes list (SA-48).
const readPage = (value: string | null) => {
  const page = Number.parseInt(value ?? '1', 10);
  return Number.isInteger(page) && page >= 1 ? page : 1;
};

export function Component() {
  const [params, setParams] = useSearchParams();
  const page = readPage(params.get('page'));
  const shares = useActiveShares(page);
  const [notice, setNotice] = useState<string>();

  const goTo = (next: number) => setParams(next === 1 ? {} : { page: String(next) });

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Active share links</h1>
      {notice && (
        <p role="alert" className="text-sm text-destructive">
          {notice}
        </p>
      )}
      {shares.isPending && <p>Loading links…</p>}
      {shares.isError && (
        <div role="alert" className="flex items-center gap-2 text-destructive">
          Could not load your share links.
          <Button variant="outline" size="sm" onClick={() => void shares.refetch()}>
            Retry
          </Button>
        </div>
      )}
      {shares.data &&
        (shares.data.items.length === 0 ? (
          <p className="text-muted-foreground">You have no active share links.</p>
        ) : (
          <>
            <ul className="flex flex-col gap-2" aria-label="Active share links">
              {shares.data.items.map((link) => (
                <ShareLinkRow
                  key={link.id}
                  link={link}
                  noteTitle={link.noteTitle}
                  onError={setNotice}
                />
              ))}
            </ul>
            <nav className="flex items-center gap-3 text-sm" aria-label="Pagination">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => goTo(page - 1)}
              >
                Previous
              </Button>
              <span>
                Page {shares.data.page} of {Math.max(shares.data.totalPages, 1)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= shares.data.totalPages}
                onClick={() => goTo(page + 1)}
              >
                Next
              </Button>
            </nav>
          </>
        ))}
    </section>
  );
}
