## Why

The API keeps full version snapshots and can restore them (AB-1009), but the editor has no way to browse or restore history. AB-1015 adds the version drawer (FRS 10.6, SDS 9.4 step 8).

## What Changes

- A drawer opened from the editor lists versions newest first (number, time), paginated, with loading, empty and error states.
- Selecting a version shows its title and content read-only (TipTap read-only view).
- Restore asks for confirmation, calls `flush()` of `useEditorSaveStore` first (AC-FEVER-07), then `POST .../restore`, applies the returned content with `editor.commands.setContent(content)` and invalidates the version list so the new version is on top.
- Restoring the latest version is blocked in the UI with an explanation; a server `409 VERSION_ALREADY_CURRENT` is shown the same way.
- Uses the existing endpoints through `apiFetch` and the shared `VersionListResponseSchema`, `VersionDetailSchema` and `NoteResponseSchema`. No new schema.

## FRS coverage

| FRS requirement | Scenarios |
| --- | --- |
| AC-FEVER-01 list newest first | S-AB1015-01 |
| AC-FEVER-02 select shows read-only content | S-AB1015-01 |
| AC-FEVER-03 restore after confirmation | S-AB1015-02 |
| AC-FEVER-04 editor shows restored content, new version on top | S-AB1015-02 |
| AC-FEVER-05 latest version blocked | S-AB1015-03 |
| AC-FEVER-06 loading, empty, error, pagination | S-AB1015-04 |
| AC-FEVER-07 flush before restore | S-AB1015-02, S-AB1015-05 |
| ERR-VER-01, 02 not found | S-AB1015-04 |
| ERR-VER-03 already latest | S-AB1015-03 |
| ERR-VER-05 no valid token | S-AB1015-06 |
| ERR-VER-06 failed restore leaves note unchanged | S-AB1015-04 |

Authorization-denied: S-AB1015-06 (401, refresh once, then `/login`). Error case: S-AB1015-04 (`404 VERSION_NOT_FOUND` and `500` shown, editor unchanged). ERR-VER-04 (malformed number or pagination) cannot be produced from the UI; the shared params schema is used and no scenario is added.

## Assumptions to confirm

- **[ASSUMPTION — confirm]** Depends on the AB-1012 editor exposing `useEditorSaveStore.flush()`, which resolves `true` on success and `false` on failure; a `false` blocks the restore and shows an error (SDS 9.4 leaves failed-flush behaviour open).
- **[ASSUMPTION — confirm]** The drawer opens from a "History" button in the editor toolbar; mounting it is done in the AB-1012 editor page.
- **[ASSUMPTION — confirm]** Page size 20 with a "Load more" button (AC-FEVER-06 allows paginate or lazy-load).
- FRS A-30 and A-36 (already-latest conflict, confirm destructive actions) are already flagged.

## Out of scope

Backend, shared schema or error code changes; diffing versions; deleting versions; changes to the notes list, search, sharing or editor beyond the mount point.

## Impact

`frontend/src/features/versions/` and the editor page mount point. Capability `frontend-versions` (new). No endpoint changes.

## Rollback

Revert the AB-1015 commits. Nothing persists client-side.
