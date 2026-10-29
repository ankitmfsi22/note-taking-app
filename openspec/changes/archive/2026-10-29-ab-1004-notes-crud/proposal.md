## Why

Users must create, open, edit and delete their notes, and recover a deleted note for 30 days (US-NOTE-1 to 3). Every later notes feature (list, tags, search, shares, versions) builds on the `Note` model added here.

## What Changes

- `Note` model and migration with the AB-1004 indexes (SDS 6.2, 6.4); soft delete via `deletedAt` only (SDS 6.5, ADR-0005).
- Six endpoints (SDS 7.1 rows 8 to 13): create, read, update, delete, trash list, restore.
- Shared schemas: `TipTapDocSchema`, `NoteCreateRequestSchema`, `NoteUpdateRequestSchema`, `NoteIdParamsSchema`, `NoteResponseSchema`, `PaginationQuerySchema`, `paginated()`, `TrashListItemSchema`, `TrashListResponseSchema` (SDS 7.2); server-side `contentText` derivation (SDS 8.1).
- `TrashPurgeJob` and the hourly scheduler (SDS 8.5).

## FRS coverage

US-NOTE-1 to 3, AC-NOTE-01 to 10, ERR-NOTE-01 to 07, FR-X-1 to 3. The AC-NOTE-07 effects on lists, search, tag counts and share links are re-tested by AB-1005 to AB-1008 when those features exist.

## Assumptions to confirm

- **[ASSUMPTION — confirm]** Limits and trash rules follow FRS A-12 to A-15 and SDS SA-24, SA-50 (repeat delete is `404`, delete and restore leave `updatedAt` alone). Recommended: as written.
- **[ASSUMPTION — confirm]** `NoteResponse.tags` is always `[]` until AB-1006 adds tags. Recommended: ship the field now so the contract does not change.

## Out of scope

`GET /notes` list, sorting and tag filter (AB-1005); tags (AB-1006); search (AB-1007); shares (AB-1008); versions and `latestVersion` (AB-1009); all frontend work (AB-1011, AB-1012).

## Impact

Capability `notes` (new). API: six paths in `delta-openapi.yaml`, binding codes from SDS 4.3 only. Database: one additive migration. No new dependency, no SDS change.

## Rollback

Revert the AB-1004 commits and drop the migration; the table is new and nothing else depends on it until AB-1005.
