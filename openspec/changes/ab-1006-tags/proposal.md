## Why

Users need coloured, per-user tags to organise notes and see how many notes each tag has (US-TAG-1 to 3). AB-1006 adds the backend; the tag UI comes with AB-1011 and AB-1012.

## What Changes

- Migration with `Tag` (`nameKey`, unique `(userId, nameKey)`) and `NoteTag`, both `onDelete: Cascade` (SDS 6.2 to 6.4).
- Endpoints 15 to 19 of SDS 7.1: `GET/POST /tags`, `PATCH/DELETE /tags/:tagId`, `PUT /notes/:noteId/tags` (whole-set replacement in one transaction).
- Shared schemas `TagCreateRequest`, `TagUpdateRequest`, `TagIdParams`, `TagResponse`, `TagWithCount`, `TagListResponse`, `SetNoteTagsRequest` (SDS 7.2). `NoteResponse.tags` is filled from `NoteTag`.

## Impact

- New capability `tags`. Codes (binding, SDS 4.3): `400 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `404 TAG_NOT_FOUND`, `404 NOTE_NOT_FOUND`, `409 TAG_NAME_TAKEN`. No SDS change.
- Depends on `Note` from AB-1004. Rollback: revert the commits and the additive migration.

## Out of scope

Tag filter on `GET /notes` (AB-1005), tag UI (AB-1011, AB-1012), tags in versions (FRS A-28), folders or nested tags (FRS 13).

## Assumptions to confirm

See the `[ASSUMPTION — confirm]` marks in `specs/tags/spec.md`; each names its Recommended default.
