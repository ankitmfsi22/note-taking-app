# Tasks: AB-1012 note editor and autosave

Estimates in minutes. Test first in each phase. Every checkpoint: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test`; never continue past a failure. Frontend only. Nothing is `[PARALLEL]` with backend work (there is none); the whole ticket runs in its own worktree next to AB-1011. Use `pnpm exec` and the pinned shadcn CLI only.

## 1. Dependencies and UI pieces

- [x] 1.1 `pnpm add -E --filter frontend @tiptap/react@3.32.0 @tiptap/core@3.32.0 @tiptap/pm@3.32.0 @tiptap/starter-kit@3.32.0`; confirm no `^` in `frontend/package.json` (5)
- [x] 1.2 shadcn `sonner`, `alert-dialog`, `badge`, `popover`, `skeleton` with CLI 4.23.0 (`--dry-run --view`, then add; check whether `sonner` pulls `next-themes`) and confirm the `sonner` version is an exact pin (15)
- [x] 1.3 Mount `<Toaster />` once in `app/providers.tsx` (5)
- [x] 1.4 Checkpoint (5)

## 2. Editor core, formatting set and safe paste

- [x] 2.1 Test S-AB1012-01 in `components/note-editor.test.tsx`: toolbar, no underline or rule, Share and History buttons present, every command's output parses with `TipTapDocSchema`. Start with the spike: real `orderedList`, `codeBlock` and `link` output against the schema; add `to-saved-doc.ts` only if it fails (30)
- [x] 2.2 Test S-AB1012-08 in the same file: `pasteHTML` with script, `onclick` and `javascript:` content (15)
- [x] 2.3 `extensions.ts`, `note-editor.tsx`, `editor-toolbar.tsx`; add jsdom stubs to `src/test/setup.ts` only if needed (45)
- [x] 2.4 Checkpoint (5)

## 3. Save state and autosave

- [x] 3.1 Unit tests for `autosave.ts` (fake timers: debounce restart, coalescing, one in flight, retry 2/4/8 s, `flush`, no retry for 400 and 404) (30)
- [x] 3.2 Tests S-AB1012-03, S-AB1012-04 and S-AB1012-05 in `pages/note-editor-autosave.test.tsx` (msw `PATCH`, fake timers; title rule, server `400`) (45)
- [x] 3.3 `save-store.ts`, `autosave.ts`, `use-autosave.ts`, `api.ts` and `queries.ts` (`getNote`, `updateNote`) (40)
- [x] 3.4 `title-field.tsx`, `save-status.tsx` (Saving, Saved, Failed with Retry, toast on first failure) (25)
- [x] 3.5 Checkpoint (5)

## 4. Tags

- [x] 4.1 Test S-AB1012-02 in `components/tag-picker.test.tsx` (assign, remove, failed `PUT` restores tags) (20)
- [x] 4.2 `listTags`, `setNoteTags`, `useTagsQuery`, `useSetNoteTagsMutation`, `tag-picker.tsx` (30)
- [x] 4.3 Checkpoint (5)

## 5. Route, page, leave guard and not-found

- [x] 5.1 Tests S-AB1012-06 (`components/leave-guard.test.tsx`: flush ok, flush fails with dialog, `beforeunload`) and S-AB1012-07 (`pages/note-editor-page.test.tsx`: 404 not-found, 401 then refresh failure goes to login) (35)
- [x] 5.2 `leave-guard.tsx`, `note-not-found.tsx`, `note-editor-page.tsx` (disabled Share and Version history buttons with `onClick` props), route `/notes/:noteId` in `router.ts`; update the route-table test (45)
- [x] 5.3 Checkpoint (5)

## 6. Verify and review

- [x] 6.1 `pnpm test --coverage` at least 80% on new code; `pnpm check:scenarios` (every S-AB1012 scenario has exactly one test); `pnpm spec:validate` (10)
- [ ] 6.2 Manual smoke in `pnpm dev` with the backend: open a note, type, watch Saving then Saved, stop the backend and watch Failed and Retry, close the tab with unsaved edits, open a deleted note (20)
- [x] 6.3 Reminder: run `/sdd-review AB-1012` in a fresh terminal; `/pr` only when all items are ✅ (0)

## Requirement and scenario map

| Requirement | Scenario | Test task | Implementation tasks |
| --- | --- | --- | --- |
| Editor page and formatting set (AC-FEEDIT-01, 09) | S-AB1012-01 | 2.1 | 2.3, 5.2 |
| Title and tags (AC-FEEDIT-02) | S-AB1012-02 | 4.1 | 4.2 |
| Autosave and save status (AC-FEEDIT-03, 04) | S-AB1012-03 | 3.1, 3.2 | 3.3, 3.4 |
| Failed saves keep edits (AC-FEEDIT-04, 05) | S-AB1012-04 | 3.1, 3.2 | 3.3, 3.4 |
| Title and content validation (AC-FEEDIT-02, ERR-NOTE-01) | S-AB1012-05 | 3.2 | 3.3, 3.4 |
| Leaving with unsaved changes (AC-FEEDIT-06) | S-AB1012-06 | 5.1 | 5.2 |
| Missing note and expired session (AC-FEEDIT-07, ERR-NOTE-02 to 06) | S-AB1012-07 | 5.1 | 5.2 |
| No script execution (AC-FEEDIT-08) | S-AB1012-08 | 2.2 | 2.3 |
