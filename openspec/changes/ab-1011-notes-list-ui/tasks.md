# Tasks: AB-1011 notes list, tags and Trash

Estimates in minutes. Test first in each phase. Every checkpoint: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test`; never continue past a failure. Frontend only and one worktree, so nothing is `[PARALLEL]` inside this ticket (AB-1012 runs in its own worktree).

## 1. UI pieces, fixtures and routes

- [x] 1.1 shadcn `dialog`, `badge`, `skeleton` with CLI 4.23.0 (`--dry-run --view`, then Write); confirm `package.json` and the lockfile are unchanged (10)
- [x] 1.2 `components/confirm-dialog.tsx` and fixtures `noteListItem`, `tag`, `trashItem` in `test/fixtures.ts` (15)
- [x] 1.3 Checkpoint (5)

## 2. Notes list and URL state (S-AB1011-01, S-AB1011-02)

- [x] 2.1 Test S-AB1011-01 in `notes-page.test.tsx`: loading, items, empty, error then Retry (25)
- [x] 2.2 Test S-AB1011-02 in `notes-page-url.test.tsx`, plus unit tests of `list-params.ts` (invalid values fall back) (25)
- [x] 2.3 `features/notes/api.ts`, `list-params.ts`, `queries.ts` (20)
- [x] 2.4 `note-card`, `note-list`, `list-toolbar`, `notes-page`; router `/notes` points to it, `notes-placeholder.tsx` removed (45)
- [x] 2.5 Checkpoint (5)

## 3. New note and delete (S-AB1011-03)

- [x] 3.1 Test S-AB1011-03 in `notes-page-actions.test.tsx` (navigates to `/notes/<id>`, dialog text, cancel sends nothing, confirm sends `DELETE`) (25)
- [x] 3.2 `createNote`, `deleteNote`, their mutations, "New note" button, delete wiring through `ConfirmDialog`, inline failure alert (30)
- [x] 3.3 Checkpoint (5)

## 4. Tag manager (S-AB1011-04)

- [x] 4.1 Test S-AB1011-04 in `tag-manager.test.tsx` (counts, empty and 31-char name send nothing, `409 TAG_NAME_TAKEN` on the field, create, rename, recolour, delete refetch) (35)
- [x] 4.2 `features/tags/api.ts`, `queries.ts`, `tag-form.tsx`, `tag-manager.tsx`, tag filter chips fed by `useTagsQuery` (50)
- [x] 4.3 Checkpoint (5)

## 5. Trash view (S-AB1011-05)

- [x] 5.1 Test S-AB1011-05 in `trash-page.test.tsx` and `days-remaining.test.ts` (25 days ago gives 5; boundary gives 0; empty, error, restore `200`, restore `404 NOTE_NOT_FOUND`) (30)
- [x] 5.2 `features/trash/api.ts`, `queries.ts`, `days-remaining.ts`, `trash-page.tsx`, router `/notes/trash`, link from the list page (40)
- [x] 5.3 Checkpoint (5)

## 6. Guards (S-AB1011-06)

- [x] 6.1 Test S-AB1011-06 in `routes/notes-guards.test.tsx` (guest at `/notes/trash`; `401 UNAUTHORIZED` then rejected refresh on `/notes`) (20)
- [x] 6.2 Fix any gap the test finds (expected none: guards and `apiFetch` come from AB-1010) (10)
- [x] 6.3 Checkpoint (5)

## 7. Final checks

- [x] 7.1 `pnpm test --coverage` at least 80% on new code (5)
- [x] 7.2 `pnpm check:scenarios` (one test per S-AB1011-01 to 06), `pnpm spec:validate` (5)
- [x] 7.3 `pnpm build`, `pnpm lint --max-warnings 0`; `grep` for `dangerouslySetInnerHTML` and `innerHTML` in `frontend/src` finds nothing (5)
- [ ] 7.4 Manual smoke against `pnpm db:up` and the dev servers: register, list, filter by tag, sort, page, delete, Trash, restore, tag CRUD; reload keeps the URL view (20)
- [ ] 7.5 Reminder for the user: run `/sdd-review AB-1011` in a fresh terminal; `/pr` only when all green (0)

## Mapping

| Requirement and scenario | Tasks |
| --- | --- |
| List content and states, S-AB1011-01 (AC-FELIST-01, 06) | 2.1, 2.3, 2.4 |
| Paging, sort and tag filter in the URL, S-AB1011-02 (AC-FELIST-02, 03) | 2.2, 2.3, 2.4, 4.2 (tag chips) |
| New note and delete, S-AB1011-03 (AC-FELIST-04, 05) | 1.2, 3.1, 3.2 |
| Tag manager, S-AB1011-04 (AC-FELIST-07) | 1.1, 4.1, 4.2 |
| Trash view and restore, S-AB1011-05 (AC-FELIST-08, 09, ERR-NOTE-05) | 5.1, 5.2 |
| Unauthenticated access, S-AB1011-06 (AC-FEAUTH-07) | 6.1, 6.2 |
| Definition of done (coverage, scenarios, validate, review) | 7.1 to 7.5 |
