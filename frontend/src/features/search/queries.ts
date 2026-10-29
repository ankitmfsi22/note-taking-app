import { useQuery } from '@tanstack/react-query';
import { fetchSearch } from './api';

// The key holds q and page, so a response for an old query is never shown for a new one.
export const useSearch = (q: string, page: number) =>
  useQuery({
    queryKey: ['search', q, page],
    queryFn: () => fetchSearch(q, page),
    enabled: q !== '',
  });
