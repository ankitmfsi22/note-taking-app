# Design: AB-1009 version history

Spec: `specs/versions/spec.md` (approved 2026-10-29). SDS 6.2, 7.1 (#26 to #28), 7.2, 8.4; ADR-0007. No new dependency, no frontend, no SDS change.

## Files

- Shared: `constants/limits.ts` (`VERSION_KEEP = 50`), `schemas/version.ts` (`VersionParamsSchema`, `VersionListItemSchema`, `VersionListResponseSchema`, `VersionDetailSchema`), `note.ts` (`latestVersion` in `NoteResponseSchema`), `types.ts`, `index.ts`.
- DB: `NoteVersion` model, `Note.lastVersionNumber`, migration `versions_note_version` with the version-1 backfill.
- Accepted exception (owner, 2026-10-29): the one-time version-1 backfill in the migration uses `gen_random_uuid()` (UUIDv4), because PostgreSQL 16 has no built-in `uuidv7()`. Every row the application creates keeps the Prisma `uuid(7)` default.
- Backend: `modules/versions/{versions.repository,versions.service,versions.controller,versions.routes}.ts`; small edits to the notes repository and service (save transaction); `app.ts` mounts `/api/v1/notes` versions routes.

## Key decisions

- One save step in the notes repository: lock (`SELECT ... FOR UPDATE` tagged template, scoped by `userId`, `deletedAt IS NULL`), compare, update with `lastVersionNumber + 1`, insert `NoteVersion`, delete `versionNumber <= new - 50`. Create inserts note and version 1 in one transaction.
- Identical title and content (`isDeepStrictEqual`) is a no-op: the row is returned and `updatedAt` is untouched. Restore reuses the same step with the version's data and returns 409 when equal.
- Time comes from the `Clock` (`updatedAt`, version `createdAt`). Missing or foreign or trashed note is `NOTE_NOT_FOUND`; missing or purged version is `VERSION_NOT_FOUND`.
- Versions routes validate params and query with shared schemas before any DB access; `requireAuth` runs first.

## Requirement to code

| Requirement | Code | Scenario |
| --- | --- | --- |
| Snapshot on save | notes save transaction | 01 |
| List and view | versions repository, service | 02 |
| Restore | versions service via the save step | 03 |
| Keep newest 50 | retention delete in the save step | 04 |
| Ownership, auth | `userId` in every query, `requireAuth` | 05 |
| Validation | shared schemas | 06 |

Risks: concurrent saves (row lock); tags not versioned; failure injection in S-03 via a Prisma client wrapper that rejects `noteVersion.create`.
