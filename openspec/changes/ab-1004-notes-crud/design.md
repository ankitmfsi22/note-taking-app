# Design: AB-1004 notes CRUD and soft delete

Spec: `specs/notes/spec.md` (approved 2026-10-29). SDS 4.3, 6.2, 6.4, 6.5, 7.1 (#8 to #13), 7.2, 7.3, 8.1, 8.5; ADR-0005. No SDS change, no new dependency, no frontend.

## Files

| Layer | Files |
| --- | --- |
| Shared | `constants/limits.ts` (`TITLE_MAX`, `CONTENT_MAX_BYTES`, `TIPTAP_MAX_DEPTH`, `TRASH_RETENTION_DAYS`, `PREVIEW_MAX`, page sizes); `schemas/tiptap.ts` (allow-list via Zod getters; depth then byte-size check runs first and aborts the pipe, so a deep body cannot recurse); `schemas/common.ts` (`PaginationQuerySchema`, `paginated()`); `schemas/note.ts`; `types.ts` |
| DB | `Note` model (AB-1004 columns and indexes only, no `lastVersionNumber`/`searchVector`), migration `notes_note` |
| Backend | `modules/notes/{content-text,notes.repository,notes.service,notes.controller,notes.routes}.ts`; `common/http/validate.ts` (`validParams`, `validQuery`); `jobs/{trash-purge.job,scheduler,purge-cli}.ts`; `config/env.ts` (`JOBS_ENABLED`); `app.ts`, `server.ts`, `package.json` (`job:purge`) |

## Key decisions

- `updatedAt` is `@updatedAt`, so Prisma would bump it on delete/restore. Create and patch set it from the `Clock`; delete and restore run in a transaction that reads the row and writes its `updatedAt` back (SA-24).
- Repository: `findActiveByIdForUser`, `updateActiveForUser` (P2025 → null), `markDeleted`, `findTrashedByIdForUser`, `markRestored`, `listTrashedForUser`, all with `userId`. The purge repository is system-wide (no user) and re-checks `deletedAt <= cutoff` in its `deleteMany`.
- Restorable `deletedAt > now - 30d`; purge `<= now - 30d`. `daysRemaining = ceil((purgeAt - now) / 1 day)`.
- Router: `requireAuth` first (401 before 400), `GET /trash` before `/:noteId`. `tags` is `[]` until AB-1006. The SA-19 identical-save no-op belongs to versioning (AB-1009).

## Requirement to code

| Requirement | Code | Scenarios |
| --- | --- | --- |
| Create, read, update | schemas, `create`/`get`/`update`, `contentText` | 01, 02 |
| Ownership and auth | `requireAuth`, `NoteIdParamsSchema`, `userId` in every `WHERE` | 03, 04 |
| Soft delete, trash, restore, purge | `markDeleted`, `listTrashedForUser`, `markRestored`, `TrashPurgeJob` | 05, 06 |

Risks: a deep TipTap body overflowing the stack (iterative depth check first); route order (S-05 hits `/trash`); boundary off-by-one (S-06 at exactly 30 days).
