## Design: AB-1015 version drawer (frontend only)

No shared schema, backend or SDS change. Schemas come from `@note-app/shared`.

| File (`frontend/src/features/versions/`) | Purpose |
| --- | --- |
| `api.ts` | `listVersions`, `getVersion`, `restoreVersion` through `apiFetch`, parsed with the shared schemas |
| `queries.ts` | keys, `useVersions` (infinite query, page size 20), `useVersion`, `useRestoreVersion` (invalidates the list) |
| `components/version-drawer.tsx` | drawer: list, states, "Load more", read-only view, restore button |
| `components/version-preview.tsx` | read-only TipTap view of a version (no `innerHTML`) |

Decisions:
- **Restore sequence (SDS 9.4 step 8):** confirm (shared `ConfirmDialog`) -> `await useEditorSaveStore.getState().flush()` -> if `false`, show error and stop -> `restoreVersion` -> `editor.commands.setContent(note.content)` via a callback prop -> invalidate the list.
- **Latest:** `versionNumber === note.latestVersion` disables restore; the `409` path shows the same text.
- **Mount:** the editor page (AB-1012) renders the drawer and a "History" button; the drawer takes `noteId`, `latestVersion` and `onRestored(note)`.
- Tests: Vitest + Testing Library + msw, one test per scenario; the save store is faked with a spy `flush`.

Depends on AB-1012 (`useEditorSaveStore`) being merged.
