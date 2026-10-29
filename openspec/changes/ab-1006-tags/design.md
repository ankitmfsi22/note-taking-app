# Design: AB-1006 tags

Spec: `specs/tags/spec.md` (approved 2026-10-29). SDS 4.3, 6.2 to 6.4, 7.1 (#15 to #19), 7.2, 7.3. No new dependency, no frontend, no migration (`Tag` and `NoteTag` exist since AB-1005; SDS 6.4 says AB-1006 adds no tables, which overrides the proposal's migration bullet).

## Files

| Layer | Files |
| --- | --- |
| Shared | `schemas/tag.ts` (`TagCreateRequestSchema`, `TagUpdateRequestSchema`, `TagIdParamsSchema`, `TagWithCountSchema`, `TagListResponseSchema`, `SetNoteTagsRequestSchema`, plus existing `TagResponseSchema`); `schemas/note.ts` (`NoteResponse.tags` becomes `TagResponseSchema[]`); `types.ts`; `constants/limits.ts` (`NOTE_TAGS_MAX`, `TAG_COLOR_DEFAULT`) |
| Backend | `modules/tags/tags.{repository,service,controller,routes}.ts`; `app.ts` mounts `/api/v1/tags`; notes router gains `PUT /:noteId/tags` wired to the tags controller; notes controller fills `tags` |

## Key decisions

- `nameKey = name.trim().normalize('NFKC').toLowerCase()` computed in the service; a `P2002` in the repository returns `null` (like `createUser`) and the service throws `409 TAG_NAME_TAKEN`. Rename to own case variant works because the unique check excludes the row itself.
- Colour is upper-cased before storing; the default `#6B7280` is already upper-case.
- List: `tag.findMany` with `_count.noteTags` filtered by `note: { deletedAt: null }`, ordered by `nameKey` then `id`.
- `setForNote` runs in one transaction: find the active note for the user (else `NOTE_NOT_FOUND`), count the caller's tags among the ids (fewer → `TAG_NOT_FOUND`), `deleteMany` then `createMany`, re-read the note with tags. `Note.updatedAt` is never written (no `note.update`), no version.
- `SetNoteTagsRequestSchema`: `uuid[]`, de-duplicate with `Set`, then max 10 (via `.transform().pipe()`).
- `NoteResponse.tags` come from `noteTags` joined to `tag`, ordered by `nameKey`; the notes repository includes them in `findActiveByIdForUser`, create, update and restore reads.

## Requirement to code

| Requirement | Code | Scenarios |
| --- | --- | --- |
| Create, list, counts | `tags.service.create/list`, filtered `_count` | 01 |
| Unique name | `nameKey`, P2002 mapping | 02 |
| Validation | shared schemas via `validate()` | 03 |
| Ownership, auth | `userId` in every `where`, `requireAuth` | 04 |
| Rename, recolour, delete | `update`, `remove`, cascade | 05 |
| Replace note tags | `setForNote` transaction | 06 |

Risks: a `nameKey` that grows past 30 characters under NFKC (column `VarChar(30)`) is rejected in the service with `400 VALIDATION_ERROR` on `name` instead of a database error (support test in `tags.test.ts`; no SDS column change); order of `NOTE_NOT_FOUND` before `TAG_NOT_FOUND`.
