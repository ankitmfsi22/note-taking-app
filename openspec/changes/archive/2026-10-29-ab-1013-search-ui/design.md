## Design: AB-1013 search UI (frontend only)

### Files
- `frontend/src/features/search/highlight.ts` - `parseHighlight(text)`.
- `frontend/src/features/search/api.ts` - `fetchSearch(q, page)` via `apiFetch` + shared `SearchResponseSchema`; `q` is URL-encoded by `URLSearchParams`, no stripping.
- `frontend/src/features/search/queries.ts` - `useSearch(q, page)` (TanStack Query, key `['search', q, page]`; no `placeholderData`, so a changed query never shows old results).
- `frontend/src/features/search/components/highlighted-text.tsx` - renders segments as text nodes, `<mark>` for highlighted ones.
- `frontend/src/features/search/components/search-results.tsx` - loading, empty, error + Retry, list, Previous/Next.
- `frontend/src/features/search/components/search-section.tsx` - the box, 300 ms debounce, `?q=&page=` in the URL; renders `children` (the normal list) when no search is active.
- `frontend/src/routes/notes-placeholder.tsx` - minimal mount: wraps its content in `SearchSection`.

### Requirement mapping
- Debounce / min 2 chars: input state is local; a 300 ms `setTimeout` writes the trimmed query to `?q=` only when its length is at least 2; shorter values remove `q` at once (this also covers clearing).
- Stale responses: the query key includes `q` and `page`, so a response for an old key is never rendered.
- Highlight safety: split on the exact `<mark>`/`</mark>` tokens, decode five entities per segment, unbalanced tags toggle state harmlessly; no innerHTML.
- Errors: `ApiError.message` shown with Retry (`refetch`); a failed 401 refresh clears the session, the app shell redirects to `/login`, and no error list is shown.

### Risks and tests
Vitest fake timers drive the debounce; msw asserts request URLs; DOM assertions check that no `script` element exists.
[ASSUMPTION - confirm] `q` and `page` live in the URL; page size 20.
