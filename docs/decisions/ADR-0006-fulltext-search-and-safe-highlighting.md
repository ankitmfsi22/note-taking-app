# ADR-0006: PostgreSQL full-text search with safely escaped highlighting

- Status: Accepted (accepted with `docs/SDS.md` on 2026-10-28)
- Date: 2026-10-28
- Tickets: AB-1007 (backend), AB-1013 (frontend)
- SDS: Sections 6.4, 8.2, 9.5

## Context

Search must use PostgreSQL full-text search only (assignment), cover title and content, rank title above content, return snippets with matched words wrapped in `<mark>`, escape everything else, treat the query as plain words, and need no manual re-indexing (AC-SRCH-01 to 11).

## Decision

- **Index.** A stored generated column on `Note`:
  `searchVector = setweight(to_tsvector('english', title), 'A') || setweight(to_tsvector('english', left(contentText, 250000)), 'B')`, with a plain GIN index on that column. PostgreSQL recomputes it on every write, so there is no trigger and no re-index step. The 250,000-character cap keeps the vector under PostgreSQL's 1 MB `tsvector` limit.
- **Why not an expression index.** Prisma 7 cannot introspect expression indexes such as `to_tsvector(...)`. A real column plus an ordinary index is visible to Prisma. Prisma cannot model generated columns, so the column and index come from a hand-edited migration (`migrate dev --create-only`). The first AB-1007 migration is checked for schema drift.
- **Query.** `plainto_tsquery('english', q)`. It reads the input as plain words joined with AND and ignores operator characters, so it cannot raise a syntax error or allow operator injection. Raw SQL is a Prisma tagged template only; `$queryRawUnsafe` is banned by lint.
- **Cost control.** Matching, ranking and `LIMIT` run first; `ts_headline` (the expensive call) runs only on the rows of the requested page.
- **Safe highlighting.** `ts_headline` does not escape HTML. Per request, generate a random nonce and ask `ts_headline` to wrap matches in `@@HL_<nonce>@@ ... @@/HL_<nonce>@@`. HTML-escape the whole result, then turn the markers into `<mark>` and `</mark>`. A user cannot forge a marker they cannot guess. The API string contains no markup other than `<mark>`.
- **Frontend.** A small parser splits on `<mark>` and `</mark>`, decodes the five entities the server produces, and renders React text nodes. No `innerHTML`, no DOMPurify.

## Consequences

- Search stays inside PostgreSQL with no extra service.
- English stemming and stop words apply. Searching only a stop word returns nothing.
- Prefix and fuzzy matching are not provided.
- Text beyond 250,000 characters of one note is not searchable.

## Alternatives considered

- **Expression GIN index on `to_tsvector(...)`:** rejected (Prisma cannot see it; drift risk).
- **Trigger-maintained `tsvector` column:** rejected; a generated column does the same with less code.
- **`websearch_to_tsquery`:** rejected; it gives users quote, `or` and minus operators, and the FRS wants plain words.
- **`ts_headline` with fixed `<mark>` markers, then escape:** rejected; escaping would break the markers, and not escaping would allow injection.
- **Sanitising with DOMPurify on the client:** rejected; the parser approach removes the HTML sink entirely.
