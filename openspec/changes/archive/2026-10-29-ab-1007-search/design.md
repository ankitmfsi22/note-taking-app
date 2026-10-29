# Design: AB-1007 full-text search

Spec: `specs/search/spec.md` (approved 2026-10-29). SDS 4.3, 6.2, 6.4, 7.1 (#20), 7.2, 8.2; ADR-0006. No SDS change, no new dependency, no frontend.

## Files

| Layer | Files |
| --- | --- |
| Shared | `constants/limits.ts` (`SEARCH_Q_MIN`, `SEARCH_Q_MAX`); `schemas/search.ts` (`SearchQuerySchema`, `SearchResultItemSchema`, `SearchResponseSchema`); `types.ts`, `index.ts` |
| DB | `Note.searchVector` (`Unsupported("tsvector")?`) + GIN index; hand-edited migration `notes_search_vector` (generated column per SDS 6.4) |
| Backend | `modules/search/{escape-highlight,search.repository,search.service,search.controller,search.routes}.ts`; `app.ts` |

## Key decisions

- One `$queryRaw` tagged template (SDS 8.2): `userId` and `"deletedAt" IS NULL` in the `WHERE`, `ts_headline` only after `LIMIT`. `total` comes from `count(*) OVER ()`; a page past the end returns no rows, so a second `count` query gives `total` then.
- Highlight: service creates an 8-byte hex nonce per request, passes it in the `ts_headline` options, then `escape-highlight.ts` HTML-escapes the headline and swaps the markers for `<mark>` (pure, unit tested).
- Tags: one small repository function (`findTagsForNotes`), returns `[]` until Tag/NoteTag land (AB-1005/1006).
- `requireAuth` runs before validation (401 before 400); `q` is trimmed by the schema.

## Requirement to code

| Requirement | Code | Scenarios |
| --- | --- | --- |
| Ranked, paginated search | migration, repository query, service | 01 |
| Safe highlight | `escape-highlight.ts` | 02 |
| Validation, plain words | `SearchQuerySchema`, `plainto_tsquery` | 03, 04 |
| Scope, empty, auth | `WHERE`, `requireAuth` | 05, 06 |

Risks: Prisma drift on the generated column (check `migrate dev` reports none); marker forgery (random nonce).
