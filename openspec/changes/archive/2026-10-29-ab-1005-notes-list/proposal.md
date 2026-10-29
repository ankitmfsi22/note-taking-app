## Why

Users need their notes listed in pages, sorted and filtered by tag so large collections stay usable (US-LIST-1 to 3). AB-1004 adds note CRUD; AB-1005 adds the list endpoint on top of it.

## What Changes

- Adds `GET /notes` (SDS 7.1 row 14) with `NoteListQuerySchema`, `NoteListItemSchema` and `NoteListResponseSchema` in `packages/shared` (SDS 7.2).
- Pagination, sort (`updatedAt`, `createdAt`, `title`, ties by `id`) and an OR tag filter via `EXISTS` (SDS 7.3).
- One migration with the indexes `(userId, deletedAt, createdAt DESC)` and `(userId, deletedAt, title)` (SDS 6.4).

## FRS coverage

| FRS requirement | Scenarios |
| --- | --- |
| AC-LIST-01, ERR-LIST-05 | S-AB1005-04, S-AB1005-05 |
| AC-LIST-02, AC-LIST-06, AC-LIST-07 | S-AB1005-01 |
| AC-LIST-03, AC-LIST-04 | S-AB1005-01, S-AB1005-02 |
| AC-LIST-05, AC-LIST-08, ERR-LIST-04 | S-AB1005-06 |
| ERR-LIST-01, ERR-LIST-02, ERR-LIST-03 | S-AB1005-03 |

## Assumptions to confirm

See the `[ASSUMPTION — confirm]` markers in the spec: the Tag/NoteTag dependency on AB-1006, duplicate and empty `tagIds`, and title collation.

## Out of scope

Tag endpoints (AB-1006), search (AB-1007), the trash list (AB-1004), the list page (AB-1011).

## Impact

New capability `notes-list`; one endpoint (`delta-openapi.yaml`); one additive index migration; three new shared schemas; no new dependency, no SDS code change.

## Rollback

Revert the AB-1005 commits and drop the two indexes. Nothing else depends on them until AB-1011.
