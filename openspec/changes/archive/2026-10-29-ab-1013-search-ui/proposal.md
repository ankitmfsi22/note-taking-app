## Why

Users can already search through the API (AB-1007), but the notes list has no search box. AB-1013 adds the search UI, with highlighted snippets rendered without ever treating note text as markup (FRS 10.4, SDS 9.5).

## What Changes

- Adds a search box on the notes list page (`/notes`). Typing starts a search 300 ms after the last keystroke, only for a trimmed query of 2 or more characters.
- Adds a results view with title (`titleHighlight`) and `snippet`, loading, no-results and error-with-retry states, and pagination.
- Adds `parseHighlight(text)` in `features/search`: splits on `<mark>`/`</mark>`, decodes only `&amp; &lt; &gt; &quot; &#39;`, returns `{ text, highlighted }[]`. Segments render as React text nodes, highlighted ones inside `<mark>`. No `dangerouslySetInnerHTML`, no DOMPurify (SA-34).
- Clearing the box returns to the normal notes list; choosing a result opens `/notes/:id` in the editor.
- Calls `GET /search` through the existing `apiFetch` and parses the response with the shared `SearchResponseSchema` (no new schema).

## FRS coverage

| FRS requirement | Scenarios |
| --- | --- |
| AC-FESRCH-01 search box on the list page | S-AB1013-01 |
| AC-FESRCH-02 300 ms debounce, minimum 2 characters | S-AB1013-01 |
| AC-FESRCH-03 title and snippet with visible highlights | S-AB1013-01 |
| AC-FESRCH-04 only `<mark>` honoured, all else text | S-AB1013-02 |
| AC-FESRCH-05 pagination, loading, no-results, error states | S-AB1013-03, S-AB1013-05 |
| AC-FESRCH-06 clearing returns to the list | S-AB1013-04 |
| AC-FESRCH-07 result opens the note in the editor | S-AB1013-01 |
| ERR-SRCH-01, ERR-SRCH-02 validation shown in UI | S-AB1013-01, S-AB1013-05 |
| ERR-SRCH-03 operator characters are plain text | S-AB1013-05 |
| ERR-SRCH-04 no valid token | S-AB1013-06 |
| ERR-SRCH-05 no result for other users' or deleted notes | S-AB1013-03 |

Authorization-denied: S-AB1013-06 (401, refresh once, then `/login`). Validation failure: S-AB1013-05 (`400 VALIDATION_ERROR` shown as an error state) and S-AB1013-01 (1-character query sends nothing).

## Assumptions to confirm

- **[ASSUMPTION — confirm]** The query lives in the URL as `?q=` on `/notes`, so reload and Back keep the search (FRS and SDS do not decide this).
- **[ASSUMPTION — confirm]** Search results use page size 20 (the API default) with Previous/Next controls.
- **[ASSUMPTION — confirm]** AB-1011 (notes list) is on `main` elsewhere; the search box is mounted on that page without changing its other behaviour.
- AC-FESRCH-02 (300 ms, 2 characters) is already marked `[ASSUMPTION — confirm]` (FRS A-35).

## Out of scope

Any backend, shared-schema or error-code change; changes to the notes list, tags, trash, editor, sharing or version features; search suggestions; recent searches; filtering search by tag.

## Impact

- Frontend only: `frontend/src/features/search/`, the notes list page (mounting the box), `frontend/src/routes/`.
- Capability `frontend-search` (new). No endpoint, schema or error code changes; `delta-openapi.yaml` states this.

## Rollback

Revert the AB-1013 commits. Nothing persists outside the URL.
