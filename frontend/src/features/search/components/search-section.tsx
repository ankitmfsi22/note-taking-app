import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Input } from '@/components/ui/input';
import { SearchResults } from './search-results';

export const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

const parsePage = (value: string | null): number => {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
};

// The search box plus its results. `children` is the normal notes list, shown while no search is
// active. The query lives in the URL (`?q=&page=`) so reload and Back keep it (assumption).
export function SearchSection({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const page = parsePage(params.get('page'));
  const [input, setInput] = useState(params.get('q') ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onChange = (value: string) => {
    clearTimeout(timer.current);
    setInput(value);
    const trimmed = value.trim();
    // Below the minimum nothing is sent, and clearing returns to the list at once.
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setParams({}, { replace: true });
    } else if (trimmed !== q) {
      timer.current = setTimeout(
        () => setParams({ q: trimmed }, { replace: true }),
        SEARCH_DEBOUNCE_MS,
      );
    }
  };

  const searching = q.length >= MIN_QUERY_LENGTH;

  return (
    <div className="flex flex-col gap-4">
      <Input
        type="search"
        aria-label="Search notes"
        placeholder="Search notes"
        value={input}
        onChange={(event) => onChange(event.target.value)}
      />
      {searching ? (
        <SearchResults
          q={q}
          page={page}
          onPageChange={(next) => setParams({ q, page: String(next) })}
        />
      ) : (
        children
      )}
    </div>
  );
}
