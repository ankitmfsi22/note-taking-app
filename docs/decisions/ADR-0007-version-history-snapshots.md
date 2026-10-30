# ADR-0007: Version history as full snapshots in the save transaction

- Status: Accepted (accepted with `docs/SDS.md` on 2026-10-28)
- Date: 2026-10-28
- Tickets: AB-1009 (backend), AB-1012 and AB-1015 (frontend)
- SDS: Sections 6.2, 8.4, 9.4

## Context

Every save of a note keeps a snapshot (AC-VER-01). Autosave must not create duplicates (AC-VER-02). Version numbers are sequential and never reused (AC-VER-04). Restore creates a new version and never rewrites history (AC-VER-07). At most the newest 50 versions are kept (FRS A-31). The note always equals its latest version, and snapshot and note update succeed or fail together (AC-VER-09, AC-VER-11).

## Decision

- Each `NoteVersion` stores the **full** title and content (not a diff), with `(noteId, versionNumber)` unique.
- `Note.lastVersionNumber` is a counter that only increases. The next number is `lastVersionNumber + 1`, so numbers are never reused after retention deletes old rows.
- Create, update and restore run in one interactive Prisma transaction. The update and restore paths first lock the note row (`SELECT ... FOR UPDATE`), which serialises concurrent saves of the same note, so numbering has no gaps and last write wins.
- A save whose title and content equal the locked row is a no-op: no version, no `updatedAt` change, `200` response.
- Restore of version N: load N, return `409 VERSION_ALREADY_CURRENT` if its content equals the note's current content, otherwise write it as a new version.
- Retention runs in the same transaction after the insert: delete rows with `versionNumber <= new - 50`.
- The AB-1009 migration backfills version 1 for notes created before the table existed.
- Tags are not versioned. The version list omits content; the detail endpoint returns it.

## Consequences

- Reading or restoring any version is a single row read. No diff replay.
- Storage grows by one full document per save, bounded at 50 per note. At the 500 KB content cap that is at most about 25 MB per note in the worst case, which is acceptable for this scope.
- Two saves of one note queue behind the row lock for a few milliseconds.
- Because autosave dedupes identical saves, a version appears only when something changed, roughly once per typing pause.

## Alternatives considered

- **Diff-based history:** rejected; complex restore and no need at this size.
- **Counter computed as `max(versionNumber) + 1`:** rejected; after a purge it could reuse a number, and it races without a lock.
- **Database trigger writing versions:** rejected; the rule set (dedupe, retention, restore) is business logic and belongs in the tested service layer.
- **Optimistic concurrency with `If-Match`:** rejected; the FRS chooses last write wins (A-39).
