import { NoteListQuerySchema } from '@note-app/shared';

export type SortBy = 'updatedAt' | 'createdAt' | 'title';
export type SortOrder = 'asc' | 'desc';

export interface ListParams {
  page: number;
  sortBy: SortBy;
  sortOrder: SortOrder;
  tagIds: string[];
}

export const DEFAULT_LIST_PARAMS: ListParams = {
  page: 1,
  sortBy: 'updatedAt',
  sortOrder: 'desc',
  tagIds: [],
};

// Each field is validated alone with the shared query schema, so one bad value (`page=abc`)
// falls back to its default without discarding the others (AC-FELIST-03).
export const parseListParams = (search: URLSearchParams): ListParams => {
  const read = <K extends 'page' | 'sortBy' | 'sortOrder' | 'tagIds'>(key: K) => {
    const raw = search.get(key);
    if (raw === null) return undefined;
    const parsed = NoteListQuerySchema.safeParse({ [key]: raw });
    return parsed.success ? parsed.data[key] : undefined;
  };
  return {
    page: read('page') ?? DEFAULT_LIST_PARAMS.page,
    sortBy: read('sortBy') ?? DEFAULT_LIST_PARAMS.sortBy,
    sortOrder: read('sortOrder') ?? DEFAULT_LIST_PARAMS.sortOrder,
    tagIds: read('tagIds') ?? DEFAULT_LIST_PARAMS.tagIds,
  };
};

// Defaults are left out so the URL stays short.
export const toSearchParams = (params: ListParams): URLSearchParams => {
  const search = new URLSearchParams();
  if (params.page !== DEFAULT_LIST_PARAMS.page) search.set('page', String(params.page));
  if (params.sortBy !== DEFAULT_LIST_PARAMS.sortBy) search.set('sortBy', params.sortBy);
  if (params.sortOrder !== DEFAULT_LIST_PARAMS.sortOrder) search.set('sortOrder', params.sortOrder);
  if (params.tagIds.length > 0) search.set('tagIds', params.tagIds.join(','));
  return search;
};
