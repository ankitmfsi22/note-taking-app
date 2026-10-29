# Design: AB-1011 notes list, tags and Trash

Follows SDS 9.1, 9.2 and 9.6. No backend or shared change; every type and schema comes from `@note-app/shared` (`NoteListQuerySchema`, `NoteListResponseSchema`, `NoteResponseSchema`, `NoteCreateRequestSchema`, `TrashListResponseSchema`, `TagListResponseSchema`, `TagResponseSchema`, `TagCreateRequestSchema`, `TagUpdateRequestSchema`, `PAGE_SIZE_DEFAULT`, `TRASH_RETENTION_DAYS`, `TAG_NAME_MAX`, `TAG_COLOR_DEFAULT`).

## Modules

| File | Role |
| --- | --- |
| `features/notes/api.ts` | `listNotes(params)`, `createNote()`, `deleteNote(id)` through `apiFetch` / `apiSend`, responses parsed with the shared schemas. `tagIds` is sent comma-joined. |
| `features/notes/list-params.ts` | Pure `parseListParams(searchParams)` and `toSearchParams(params)`. Reads `page`, `sortBy`, `sortOrder`, `tagIds`, validates with `NoteListQuerySchema.safeParse` and falls back to defaults field by field. |
| `features/notes/queries.ts` | `useNotesQuery(params)`, `useCreateNoteMutation`, `useDeleteNoteMutation`. |
| `features/notes/components/note-card.tsx`, `note-list.tsx`, `list-toolbar.tsx` | Card (title, preview, tag `Badge`s, date, Delete button), list with loading, empty and error states, sort select and tag filter chips. |
| `features/notes/pages/notes-page.tsx` | Lazy route module for `/notes`: toolbar, list, pager, tag manager, link to Trash. Owns `useSearchParams`. |
| `components/confirm-dialog.tsx` | Shared `ConfirmDialog` (SDS 9.6) on shadcn `dialog`: title, description, Cancel and Confirm. Reused later by AB-1014 and AB-1015. |
| `features/tags/api.ts`, `queries.ts` | `listTags`, `createTag`, `updateTag`, `deleteTag`; `useTagsQuery` and three mutations. |
| `features/tags/components/tag-manager.tsx`, `tag-form.tsx` | Tag list with note count, create form, inline rename and recolour (`<input type="color">`), delete through `ConfirmDialog`. Forms use react-hook-form with `zodResolver(TagCreateRequestSchema)` / `TagUpdateRequestSchema`; `mapServerErrors` from `features/auth/server-errors.ts` maps `TAG_NAME_TAKEN` and `details` onto the name field. |
| `features/trash/api.ts`, `queries.ts` | `listTrash(page)`, `restoreNote(id)`; `useTrashQuery`, `useRestoreNoteMutation`. |
| `features/trash/days-remaining.ts` | Pure `daysRemaining(deletedAt: string, now: Date): number` = `max(0, ceil((deletedAt + TRASH_RETENTION_DAYS days - now) / 86 400 000))`, the server's rule. The component passes `new Date()`; tests pass a fixed date, so no fake timers are needed. |
| `features/trash/pages/trash-page.tsx` | Lazy route module for `/notes/trash`: rows with title, deletion date, "N days left", Restore; loading, empty, error-with-retry; restore failure alert. |
| `routes/router.ts` | `/notes` lazy -> `notes-page`, new `/notes/trash` lazy -> `trash-page`, both under `require-auth`; `notes-placeholder.tsx` removed. |

## Decisions

- **URL is the state** (AC-FELIST-03, SDS 9.1). The page derives params with `parseListParams(useSearchParams()[0])` on every render; changes call `setSearchParams(next)` built from the current params. Per the docs, the functional form of `setSearchParams` does not queue within one tick, so each handler makes a single call. Changing sort or tags resets `page` to 1. Navigation uses push (back button works); `replace` is not used.
- **Query keys** from SDS 9.2: `['notes','list', params]`, `['notes','trash', page]`, `['tags']`. List and trash queries use `placeholderData: keepPreviousData` (TanStack Query v5) so paging does not flash; the page shows a dimmed list while `isPlaceholderData`.
- **Invalidation** (SDS 9.2): create note -> `['notes','list']`; delete note -> `['notes','list']`, `['notes','trash']`, `['tags']`; restore -> `['notes','list']`, `['notes','trash']`, `['tags']`; tag create, update, delete -> `['tags']` and `['notes','list']`. Mutations use `onSuccess` returning the `invalidateQueries` promise. No server data is copied into Zustand or component state; the only Zustand store touched is the existing session store (a failed refresh clears it and `AppShell` navigates to `/login`).
- **Delete** opens `ConfirmDialog` with the text "This note moves to Trash. You can restore it from Trash for 30 days." (the number from `TRASH_RETENTION_DAYS`). The dialog holds the pending note id in component state.
- **Errors**: a list or trash error shows an `role="alert"` block with a Retry button calling `refetch()`. Restore `404 NOTE_NOT_FOUND` shows "This note can no longer be restored. It may have been deleted more than 30 days ago." and invalidates the trash list. Create-note and delete failures show an inline alert; no toasts (`sonner` belongs to AB-1012).
- **401**: handled by AB-1010's `apiFetch` (refresh once, then `clearSession`); `AppShell` redirects. This ticket adds no 401 code, only a test (S-AB1011-06).
- **Safety**: all text (titles, previews, tag names) is rendered as React text nodes; `dangerouslySetInnerHTML` and `innerHTML` are not used. Tag colours are validated by the shared schema (`#RRGGBB`) before use in `style`.
- **Tag filter**: chips with `aria-pressed`; selecting more than `LIST_TAG_IDS_MAX` (10) tags is blocked in the UI.
- **Sort controls**: native `<select>` elements styled with Tailwind (the Radix select is awkward in jsdom). No shadcn `select`.
- Library APIs checked with Context7 before use: `useSearchParams` / `setSearchParams` (react-router 7), `placeholderData: keepPreviousData` and `invalidateQueries` (TanStack Query 5), `server.use`, `HttpResponse.json` and `HttpResponse.error()` (msw 2).

## shadcn components (pinned CLI, written with the Write tool after `--dry-run --view`)

`pnpm dlx shadcn@4.23.0 add dialog badge skeleton --cwd frontend --yes`. They use the already-pinned `radix-ui` and `lucide-react`; no `package.json` or `pnpm-lock.yaml` change is expected. If the CLI would add a package, stop and ask.

## Dependencies

None added. `sonner` and TipTap are not used here (AB-1012 owns them in a parallel worktree).

## Test files

| Scenario | File |
| --- | --- |
| S-AB1011-01 | `features/notes/pages/notes-page.test.tsx` |
| S-AB1011-02 | `features/notes/pages/notes-page-url.test.tsx` (plus unit tests of `list-params.ts`) |
| S-AB1011-03 | `features/notes/pages/notes-page-actions.test.tsx` |
| S-AB1011-04 | `features/tags/components/tag-manager.test.tsx` |
| S-AB1011-05 | `features/trash/pages/trash-page.test.tsx` (plus `days-remaining.test.ts`) |
| S-AB1011-06 | `routes/notes-guards.test.tsx` |

Tests render with `createMemoryRouter` and the real `routes` where routing matters, use msw handlers from `test/server.ts` plus `server.use` overrides, and fixtures added to `test/fixtures.ts` (`noteListItem`, `tag`, `trashItem`).

## FRS to scenario table

| FRS ID | Scenario |
| --- | --- |
| AC-FELIST-01 | S-AB1011-01 |
| AC-FELIST-02 | S-AB1011-02 |
| AC-FELIST-03 | S-AB1011-02 |
| AC-FELIST-04 | S-AB1011-03 |
| AC-FELIST-05 | S-AB1011-03 |
| AC-FELIST-06 | S-AB1011-01 |
| AC-FELIST-07 | S-AB1011-04 |
| AC-FELIST-08 | S-AB1011-05 |
| AC-FELIST-09 | S-AB1011-05 |
| ERR-NOTE-05 (shown in UI) | S-AB1011-05 |
| AC-FEAUTH-07 on these pages | S-AB1011-06 |
