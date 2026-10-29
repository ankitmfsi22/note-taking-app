# Design: AB-1005 notes list

Spec: `specs/notes-list/spec.md` (approved 2026-10-29). SDS 6.2, 6.4, 7.1 (#14), 7.2, 7.3, 8.1. No new dependency, no frontend.

## Files

| Layer | Files |
| --- | --- |
| Shared | `constants/limits.ts` (`LIST_TAG_IDS_MAX`); `schemas/tag.ts` (`TagResponseSchema`, pulled forward from AB-1006); `schemas/note.ts` (`NoteListQuerySchema`, `NoteListItemSchema`, `NoteListResponseSchema`); `types.ts`, `index.ts` |
| DB | `Tag` and `NoteTag` exactly as SDS 6.2 (unique `(userId, nameKey)`, `NoteTag(tagId)`), plus `Note` indexes `(userId, deletedAt, createdAt DESC)` and `(userId, deletedAt, title)`; migration `notes_list_tags` |
| Backend | `modules/notes/notes.{repository,service,controller,routes}.ts` |

## Key decisions

- **Early tables (spec assumption, owner default):** the tag filter and item `tags` need `Tag`/`NoteTag`, which SDS 6.4 assigns to AB-1006. AB-1005 creates both models in its own migration, with no tag endpoints; AB-1006 adds only endpoints. SDS 6.4 is not edited here; the SDS row moves when AB-1006 is archived. Tests seed tags through Prisma.
- `tagIds` is a comma-separated string: split, de-duplicate, then `uuid[]` with 1 to 10 entries. An empty value or entry fails as a non-UUID (400).
- Repository `listActiveForUser`: `where { userId, deletedAt: null, noteTags: { some: { tagId: { in } } } }` (Prisma compiles `some` to a subquery, so a note appears once; no join duplicates), `orderBy [{ [sortBy]: sortOrder }, { id: sortOrder }]`, tags included by name. `count` uses the same `where`.
- `countTagsForUser(userId, ids)`: fewer than `ids.length` → `404 TAG_NOT_FOUND`, checked before listing.
- Title order uses the default collation (spec assumption). `NoteResponse.tags` stays `[]` until AB-1006.

## Requirement to code

| Requirement | Code | Scenarios |
| --- | --- | --- |
| Paginated list, items | `list`, `previewOf`, `NoteListResponseSchema` | 01 |
| Deterministic sort | `orderBy` with `id` tie-break | 02 |
| Query validation | `NoteListQuerySchema` via `validate({ query })` | 03 |
| Auth and ownership | `requireAuth`, `userId` in `where` | 04 |
| Soft-deleted excluded | `deletedAt: null` in list and count | 05 |
| Tag filter | `noteTags.some`, `countTagsForUser` | 06 |

Risks: route order (`GET /` vs `/trash`), tie-break overlap across pages, migration drift with the pulled-forward tables.
