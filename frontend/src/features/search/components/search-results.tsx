import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { useSearch } from '../queries';
import { HighlightedText } from './highlighted-text';

interface SearchResultsProps {
  q: string;
  page: number;
  onPageChange: (page: number) => void;
}

export function SearchResults({ q, page, onPageChange }: SearchResultsProps) {
  const search = useSearch(q, page);

  if (search.isPending) {
    return (
      <p role="status" className="text-muted-foreground">
        Searching…
      </p>
    );
  }

  if (search.isError) {
    // A failed refresh already cleared the session; the app shell is sending the user to /login.
    if (search.error instanceof ApiError && search.error.status === 401) return null;
    return (
      <div role="alert" className="flex flex-col items-start gap-2">
        <p>{search.error.message}</p>
        <Button variant="outline" size="sm" onClick={() => void search.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const { items, totalPages } = search.data;
  if (items.length === 0) {
    return <p className="text-muted-foreground">{`No results for "${q}".`}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {items.map((result) => (
          <li key={result.id}>
            <Link
              to={`/notes/${result.id}`}
              className="block rounded-lg border p-3 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="block font-medium">
                <HighlightedText text={result.titleHighlight} />
              </span>
              <span className="block text-sm text-muted-foreground">
                <HighlightedText text={result.snippet} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <nav aria-label="Search pages" className="flex items-center gap-3 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span>{`Page ${search.data.page} of ${totalPages}`}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}
