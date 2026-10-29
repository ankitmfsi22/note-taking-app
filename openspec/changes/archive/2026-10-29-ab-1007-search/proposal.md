## Why

Users must find their notes by keyword and see why a note matched (US-SRCH-1, US-SRCH-2). AB-1007 adds the backend search on PostgreSQL full-text search only (ADR-0006). The search UI comes with AB-1013.

## What Changes

- Hand-edited migration: generated `Note.searchVector` (title weight A, first 250,000 chars of `contentText` weight B) and GIN index `Note_searchVector_idx` (SDS 6.2, 6.4).
- `GET /search` (SDS 7.1 row 20) with `SearchQuerySchema`, `SearchResultItemSchema`, `SearchResponseSchema` in `packages/shared` (SDS 7.2).
- Search repository: one `$queryRaw` tagged template with `plainto_tsquery('english')`, `userId` and `"deletedAt" IS NULL` in the `WHERE`, `ts_headline` only on the page's rows; tags by a second query (SDS 8.2).
- Safe highlight: per-request nonce markers, HTML-escape, then `<mark>` (SDS 8.2, ADR-0006).

## Impact

- New capability `search`. Codes: `200`, `400 VALIDATION_ERROR`, `401 UNAUTHORIZED` (SDS 4.3, 7.1). No SDS change.
- Depends on `Note` (AB-1004) and `Tag`/`NoteTag` (AB-1006). No new dependency.

## Assumptions to confirm

- **[ASSUMPTION — confirm]** FRS A-22 and SDS SA-14, SA-15 as written (title and content, title ranks higher, `<mark>`, 2 to 200 chars, stop-word-only query gives empty page). Recommended: accept.
- **[ASSUMPTION — confirm]** `'` is escaped as `&#39;` (SDS 8.2 names no entity). Recommended: `&#39;`.
- **[ASSUMPTION — confirm]** Title-only match: `snippet` is the start of the content text with no `<mark>` (default `ts_headline` behaviour). Recommended: accept.

## Out of scope

Search UI (AB-1013); combining search with the tag filter (FRS A-22); prefix, fuzzy or operator search.

## Rollback

Revert the AB-1007 commits and drop the migration (column and index only; no data lost).
