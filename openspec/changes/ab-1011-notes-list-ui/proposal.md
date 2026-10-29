## Why

AB-1011 replaces the `/notes` placeholder from AB-1010 with the real notes list page, the tag manager and the Trash view (FRS 10.2, SDS 9.1, 9.2 and 9.6). Every endpoint it needs is already on `main` (AB-1004, AB-1005, AB-1006), so this is a frontend-only ticket.

## What Changes

- Adds the `/notes` page: note cards (title, preview, tags, last-updated date), paging, sort field and direction, tag filter, with page, sort and tags kept in the URL (`useSearchParams`).
- Adds loading, empty and error-with-retry states, a "New note" action (`POST /notes`, then open `/notes/:noteId`), and delete with a `ConfirmDialog` that says the note can be restored from Trash for 30 days.
- Adds a tag manager (create, rename, recolour, delete, note count) validated with the shared tag schemas.
- Adds the `/notes/trash` page: trashed notes with deletion date and days remaining, a Restore action, loading, empty and error states, and a clear message when the 30 days have passed.
- Adds TanStack Query hooks per feature (`features/notes`, `features/tags`, `features/trash`) with the query keys from SDS 9.2.
- Adds shadcn components as needed (`dialog`, `badge`, `skeleton`; exact list in `design.md`) through the pinned CLI 4.23.0.

## FRS coverage

| FRS requirement | Scenarios |
| --- | --- |
| AC-FELIST-01 notes show title, preview, tags, updated date | S-AB1011-01 |
| AC-FELIST-02 paging, sort field and direction, any-of tag filter | S-AB1011-02 |
| AC-FELIST-03 page, sort and tags in the URL | S-AB1011-02 |
| AC-FELIST-04 new note opens the editor | S-AB1011-03 |
| AC-FELIST-05 delete needs confirmation, Trash 30 days text | S-AB1011-03 |
| AC-FELIST-06 loading, empty, error with retry | S-AB1011-01 |
| AC-FELIST-07 tag create, rename, recolour, delete, count | S-AB1011-04 |
| AC-FELIST-08 Trash view, days remaining, not in normal list | S-AB1011-05 |
| AC-FELIST-09 Restore, Trash states, expired-restore message | S-AB1011-05 |
| 10.2 errors (list and tag errors, ERR-NOTE-05 shown in UI) | S-AB1011-01, S-AB1011-04, S-AB1011-05 |

Authorization-denied: S-AB1011-06 (guest at `/notes/trash` goes to login; a failed silent refresh on the list ends the session and shows login). Validation failure: S-AB1011-04 (tag form uses the shared schemas, `TAG_NAME_TAKEN` shown on the name field).

## Assumptions to confirm

- **[ASSUMPTION — confirm]** "New note" creates the note with the title `Untitled` and the default empty document, then navigates to `/notes/:noteId`. That route is built by AB-1012 (parallel); until it lands the router shows the not-found page, and the test only asserts the request and the navigation.
- **[ASSUMPTION — confirm]** Days remaining in Trash is computed in the browser from `deletedAt` plus `TRASH_RETENTION_DAYS` (30) with `Math.ceil`, the same rule as the server's `daysRemaining`, via a pure helper that takes `now`.
- **[ASSUMPTION — confirm]** Invalid or missing `page`, `sortBy`, `sortOrder` or `tagIds` in the URL fall back to the defaults (page 1, `updatedAt`, `desc`, no tags) without an error. A `404 TAG_NOT_FOUND` from the list (a deleted tag in a shared URL) drops the unknown tag filter and shows a notice.
- **[ASSUMPTION — confirm]** Page size is fixed at the default 20; there is no page size control.
- **[ASSUMPTION — confirm]** SDS 9.6 lists `sonner` toasts. AB-1012 adds it in parallel, so this ticket uses inline status and alert messages and no toasts.
- **[ASSUMPTION — confirm]** Deleting a tag asks for confirmation through the same `ConfirmDialog` (FRS A-36 lists notes, links and versions only).

## Out of scope

The note editor and TipTap (AB-1012), search box and highlights (AB-1013, the `q` param is not handled here), sharing and the versions drawer, permanent delete or "empty trash" (no endpoint), any backend or shared-schema change, any new dependency.

## Impact

- Frontend only: `frontend/src/features/notes/`, `features/tags/`, `features/trash/`, `frontend/src/routes/router.ts`, `frontend/src/components/ui/` (generated), `frontend/src/test/`. `notes-placeholder.tsx` is removed.
- Capability `frontend-notes-list` (new). No endpoint, schema or error code changes, so there is no `delta-openapi.yaml` (the AB-1010 template had none either).
- No new package. `pnpm-lock.yaml` is not expected to change; shadcn components use `radix-ui` and `lucide-react`, already pinned.

## Rollback

Revert the AB-1011 commits. The app falls back to the AB-1010 placeholder. Nothing is stored in the browser.
