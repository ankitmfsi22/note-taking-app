## Why

Users want every save of a note kept so they can look back and restore an old version without losing newer history (US-VER-1, US-VER-2). AB-1009 adds the backend; the drawer UI comes with AB-1015.

## What Changes

- `NoteVersion` table, `Note.lastVersionNumber` counter, and a migration that backfills version 1 for existing notes (SDS 6.2, 8.4).
- One save transaction for create, `PATCH` and restore: row lock, identical save is a no-op, snapshot, keep the newest 50 (ADR-0007).
- Three endpoints: list, view and restore versions (SDS 7.1 rows 26 to 28); `latestVersion` added to `NoteResponseSchema`.

## Assumptions to confirm

- **[ASSUMPTION — confirm]** Restore returns `409 VERSION_ALREADY_CURRENT` whenever the target equals the current title and content, not only for the latest number (SDS SA-20). Recommended: yes.
- **[ASSUMPTION — confirm]** Retention runs inside the save transaction, by version number (SDS SA-22). Recommended: yes.
- **[ASSUMPTION — confirm]** The create and `PATCH` changes and `latestVersion` are specified in this `versions` delta, because the `notes` capability (AB-1004) is not archived yet (SDS SA-21). Recommended: move them to a MODIFIED `notes` requirement once AB-1004 is archived.

## Out of scope

Version UI (AB-1015), versioning tags, age-based purge, diffs between versions.

## Impact and rollback

Capability `versions` (new). One additive migration, three endpoints, one schema field. No SDS code or endpoint changes. Rollback: revert the AB-1009 commits and the migration.
