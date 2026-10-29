## Why

AB-1012 gives the SPA its note editor: a user opens `/notes/:noteId`, edits the title and rich text with TipTap, assigns tags, and every change saves itself with a visible status (FRS 10.3, SDS 9.4). The notes, tags and versions API is already on `main` (AB-1004, AB-1006, AB-1009); the session, `apiFetch` and the route guards are on `main` (AB-1010).

## What Changes

- Adds the route `/notes/:noteId` (lazy, under `RequireAuth` and `AppShell`) with the editor page: title field, TipTap editor with a formatting toolbar, tag picker, save-status indicator, and Share and Version history buttons.
- Adds the Zustand `useEditorSaveStore` (`status`, `isDirty`, registered `flush()`), the autosave controller and its `useAutosave` hook: 2 s debounce, coalesced edits, one request in flight, retries at 2, 4 and 8 s, then a manual Retry.
- Adds the leave guard: `useBlocker` flushes or asks "discard changes?", plus a `beforeunload` warning.
- Adds a not-found state for `404 NOTE_NOT_FOUND` (missing, deleted or another user's note).
- Adds pinned dependencies `@tiptap/react`, `@tiptap/core`, `@tiptap/pm`, `@tiptap/starter-kit` (3.32.0 each) and `sonner`, plus the shadcn `sonner`, `alert-dialog`, `badge`, `popover` and `skeleton` components (CLI 4.23.0).

## FRS coverage

FRS 10.3, AC-FEEDIT-01 to AC-FEEDIT-09; ERR-NOTE-01 (title validation), ERR-NOTE-02 to ERR-NOTE-04 (not found) and ERR-NOTE-06 (no valid token) as seen from the UI. Backend rules are already covered by AB-1004, AB-1006 and AB-1009.

| FRS requirement | Scenarios |
| --- | --- |
| AC-FEEDIT-01 formatting set | S-AB1012-01 |
| AC-FEEDIT-02 title, tags | S-AB1012-02, S-AB1012-05 |
| AC-FEEDIT-03 autosave after 2 s | S-AB1012-03 |
| AC-FEEDIT-04 save status | S-AB1012-03, S-AB1012-04 |
| AC-FEEDIT-05 edits kept on failure | S-AB1012-04 |
| AC-FEEDIT-06 leave warning | S-AB1012-06 |
| AC-FEEDIT-07 not-found state | S-AB1012-07 |
| AC-FEEDIT-08 no script execution | S-AB1012-08 |
| AC-FEEDIT-09 share and history actions | S-AB1012-01 |

Authorization-denied: S-AB1012-07 (another user's note gives `404 NOTE_NOT_FOUND`; an unrenewable `401` goes to `/login`). Validation failure: S-AB1012-05.

## Assumptions to confirm

- **[ASSUMPTION — confirm]** The Share and Version history buttons are present but disabled with an explanatory title until AB-1014 and AB-1015 wire them. AB-1014 and AB-1015 only pass an `onClick`; the layout does not change.
- **[ASSUMPTION — confirm]** Autosave uses `PATCH /notes/:noteId` with `{ title, content }` (SDS 7.1 row 10, SDS 9.4). Tag changes use `PUT /notes/:noteId/tags` immediately and are not part of the debounce.
- **[ASSUMPTION — confirm]** The tag picker lists existing tags (`GET /tags`) and assigns or removes them. Creating, renaming and deleting tags stays in AB-1011 (AC-FELIST-07).
- **[ASSUMPTION — confirm]** A `400 VALIDATION_ERROR` or `404 NOTE_NOT_FOUND` on autosave is not retried automatically (a retry cannot succeed); only network errors and `500` are retried at 2, 4 and 8 s.
- **[ASSUMPTION — confirm]** `sonner` has no version in SDS 3.3, so the exact version is the registry `latest` (2.0.8, resolved 2026-10-29). SDS 3.3 gets a row when this change is archived.
- **[ASSUMPTION — confirm]** TipTap 3.32.0 may emit attributes the strict `TipTapDocSchema` rejects (for example an `orderedList` `type` attribute). Phase 2 starts with a test that validates real editor output against the schema. If it fails, the editor strips the extra attributes before saving; a shared-schema change would need its own spec.

## Out of scope

The share modal (AB-1014) and version drawer (AB-1015); tag create, rename and delete; the notes list and search UI; creating a note (AB-1011 "new note"); image or file attachments; real-time collaboration; any backend or shared-schema change.

## Impact

- Frontend only: `frontend/src/features/editor/`, `frontend/src/routes/router.ts`, `frontend/src/components/ui/` (generated), `frontend/src/test/setup.ts` if jsdom stubs are needed, `frontend/package.json`.
- The root `pnpm-lock.yaml` changes when dependencies are added. This is unavoidable with pnpm workspaces.
- `router.ts` is also edited by AB-1011 (parallel worktree); the merge conflict is one array entry.
- Capability `frontend-note-editor` (new). No endpoint, schema or error code changes, so there is no `delta-openapi.yaml` (the AB-1010 template had none either).

## Rollback

Revert the AB-1012 commits. Nothing persists outside the browser memory; saved note data is ordinary note data.
