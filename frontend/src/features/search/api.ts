import { SearchResponseSchema } from '@note-app/shared';
import { apiFetch } from '@/lib/api-client';

export const SEARCH_PAGE_SIZE = 20;

// URLSearchParams encodes q exactly as typed; operator characters are plain text (ERR-SRCH-03).
export const fetchSearch = (q: string, page: number) => {
  const params = new URLSearchParams({
    q,
    page: String(page),
    pageSize: String(SEARCH_PAGE_SIZE),
  });
  return apiFetch(`/search?${params.toString()}`, SearchResponseSchema);
};
