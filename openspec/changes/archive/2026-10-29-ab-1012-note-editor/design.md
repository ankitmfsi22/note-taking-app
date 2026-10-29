# Design: AB-1012 note editor and autosave

Follows SDS 9.1, 9.2, 9.4 and 9.6 and the allow-list of SDS 8.1. No backend or shared change; every type comes from `@note-app/shared`. Library APIs below were checked with Context7 (Rule 9): TipTap `useEditor`, `StarterKit.configure`, `setContent`, `immediatelyRender`; react-router `useBlocker`; Vitest fake timers; msw 2.

## Modules

| File | Role |
| --- | --- |
| `features/editor/api.ts` | `getNote`, `updateNote` (`PATCH`), `setNoteTags` (`PUT /notes/:id/tags`), `listTags`. All through `apiFetch` with `NoteResponseSchema`, `NoteUpdateRequestSchema`, `SetNoteTagsRequestSchema`, `TagListResponseSchema`. |
| `features/editor/queries.ts` | `useNoteQuery(noteId)` key `['notes','detail',noteId]` (`retry: false` on 404), `useTagsQuery()` key `['tags']`, `useSetNoteTagsMutation(noteId)` (success: `setQueryData` detail, invalidate `['tags']` and `['notes','list']`). The save success path does `setQueryData` for `updatedAt` only. |
| `features/editor/save-store.ts` | Zustand `useEditorSaveStore`: `status` (`idle`, `saving`, `saved`, `error`), `isDirty`, `errorMessage`, `canRetry`, `flush` (registered by the open editor, `null` otherwise), `register(flush)`, `reset()`. This is the store AB-1015 reads. |
| `features/editor/autosave.ts` | Framework-free `createAutosaver({ save, debounceMs: 2000, retryDelaysMs: [2000, 4000, 8000], timers })`. `timers` defaults to `{ setTimeout, clearTimeout }` and is injectable. Methods `markDirty()`, `flush(): Promise<boolean>`, `retry()`, `dispose()`. Reports state through an `onState` callback. |
| `features/editor/use-autosave.ts` | `useAutosave({ noteId, getDraft })`: creates one autosaver per note, wires `save` to `updateNote`, pushes state into `useEditorSaveStore`, registers `flush`, disposes on unmount. |
| `features/editor/extensions.ts` | `editorExtensions`: the one extension list, used by the editable editor and by tests (and later by AB-1014 and AB-1015 read-only views). |
| `features/editor/to-saved-doc.ts` | `toSavedDoc(json)`: returns the editor JSON as is, or with attributes the schema does not allow removed, then `TipTapDocSchema.parse`. Only if the phase 2 spike shows the extra attributes **[ASSUMPTION — confirm]**. |
| `features/editor/components/editor-toolbar.tsx` | Toolbar buttons (shadcn `Button`) from the allow-list; active state from `useEditorState`. |
| `features/editor/components/note-editor.tsx` | `useEditor({ extensions: editorExtensions, content, onUpdate, immediatelyRender: false })` and `EditorContent`. `onUpdate` calls `markDirty()`. Content is passed once; the response never calls `setContent`. |
| `features/editor/components/title-field.tsx` | shadcn `Input` plus field error; validates with the shared title rule. |
| `features/editor/components/tag-picker.tsx` | Shadcn `Popover` with the user's tags as toggle rows, selected tags as `Badge`s with a remove button. |
| `features/editor/components/save-status.tsx` | `Saving`, `Saved`, `Failed` plus Retry button, `role="status"`. |
| `features/editor/components/leave-guard.tsx` | `useBlocker` and `beforeunload`; renders the shadcn `AlertDialog` "Discard changes?" when the flush fails. |
| `features/editor/components/note-not-found.tsx` | Not-found state with a link to `/notes`. |
| `features/editor/pages/note-editor-page.tsx` | Lazy route module (`Component`): reads `noteId`, loads the note, renders the layout and the Share and Version history buttons (disabled placeholders, `onClick` props for AB-1014 and AB-1015). Keyed by `noteId` so a new note remounts the editor. |
| `routes/router.ts` | Adds `{ path: '/notes/:noteId', lazy: () => import('@/features/editor/pages/note-editor-page') }` under `require-auth`. |

## Decisions

- **Autosave controller is plain TypeScript.** The state machine lives in `autosave.ts` so the debounce, coalescing and retry rules are tested with `vi.useFakeTimers()` and `vi.advanceTimersByTimeAsync()` without rendering TipTap. Component tests cover the wiring.
- **Coalescing.** `markDirty()` restarts the 2 s timer. When the timer fires and a save is running, a `pending` flag is set and the next save starts in the `finally` of the running one. `getDraft()` is read when the request starts, so it always sends the latest title and content.
- **Retries.** Network errors and `500` retry after 2, 4, then 8 s (a new edit resets the sequence and uses the normal debounce). `400` and `404` stop at `error` with `canRetry` true for a manual Retry (a user fixing the title can also just edit).
- **`flush()`** cancels the debounce, waits for the running save, saves if dirty, and resolves `true` on success. The leave guard and AB-1015 call it through the store.
- **Leave guard.** `useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname)` reads the dirty state from the store. When `blocked`, it calls `flush()`: `true` calls `blocker.proceed()`, `false` opens the dialog (Stay calls `blocker.reset()`, Leave calls `proceed()`). `beforeunload` is registered only while dirty or saving.
- **StarterKit options (TipTap 3).** `StarterKit.configure({ underline: false, horizontalRule: false, heading: { levels: [1, 2, 3] }, link: { openOnClick: false, protocols: [...] }, ... })`. StarterKit 3 bundles `link` and `underline`; the history option is named `undoRedo`. The exact `link` option keys (default protocols, `isAllowedUri`) are read from the installed 3.32.0 typings and Context7 in phase 2 before use. Extensions that add no content (`dropcursor`, `gapcursor`, `listKeymap`, `trailingNode`) stay on. The allow-list test (S-AB1012-01) runs every command and parses the output with `TipTapDocSchema`.
- **`setContent` is not used** in this ticket; `emitUpdate` defaults to `true` in TipTap 3, which AB-1015 must pass as `false` or accept as a dirty mark.
- **jsdom.** `immediatelyRender: false` avoids a render-time sync that jsdom handles poorly. ProseMirror needs `Range.getClientRects`, `Range.getBoundingClientRect` and `document.elementFromPoint`; phase 2 adds stubs to `src/test/setup.ts` only if a test needs them. Paste is simulated by dispatching a `ClipboardEvent`-like event through `editor.view.pasteHTML(html)` (ProseMirror view API), which runs the real schema parser.
- **Never `dangerouslySetInnerHTML`.** Content is rendered by ProseMirror from the schema.
- **Toasts** use `sonner` (`toast.error`) for the first save failure and tag errors; a `<Toaster />` is mounted once in `app/providers.tsx`.
- **Two Zustand stores only** (frontend/CLAUDE.md): the new one is the editor save state. Server data stays in TanStack Query; the editor owns its live document, which is not copied into Zustand.

## Dependencies

| Package | Version | Where | Note |
| --- | --- | --- | --- |
| `@tiptap/react`, `@tiptap/core`, `@tiptap/pm`, `@tiptap/starter-kit` | 3.32.0 each | `frontend` | SDS 3.3; `pnpm add -E --filter frontend ...` with exact versions. |
| `sonner` | 2.0.8 | `frontend` | Not pinned in SDS 3.3; the registry `latest` on 2026-10-29. **[ASSUMPTION — confirm]** The shadcn `sonner` component installs it; verify the pin is exact. |
| shadcn `sonner`, `alert-dialog`, `badge`, `popover`, `skeleton` | CLI 4.23.0 | `frontend/src/components/ui/` | `pnpm dlx shadcn@4.23.0 add <name> --cwd frontend --yes` after `--dry-run --view`. The generated `sonner` may import `next-themes`; if so the dry run shows it and the Toaster is written without a theme hook **[ASSUMPTION — confirm]**. AB-1011 may add the same `badge`, `alert-dialog` or `skeleton`; identical generated files merge cleanly. |

The root `pnpm-lock.yaml` changes when these are added. This is unavoidable with pnpm workspaces; no other file outside `frontend/` and this change folder is touched.

## FRS to scenario

| FRS ID | Scenario | Notes |
| --- | --- | --- |
| AC-FEEDIT-01 | S-AB1012-01 | Toolbar and allow-list equals `TipTapDocSchema` |
| AC-FEEDIT-02 | S-AB1012-02, S-AB1012-05 | Tags; title validation |
| AC-FEEDIT-03 | S-AB1012-03 | 2 s debounce, coalescing, one in flight |
| AC-FEEDIT-04 | S-AB1012-03, S-AB1012-04 | Saving, Saved, Failed with Retry |
| AC-FEEDIT-05 | S-AB1012-04 | Edits kept, retries 2/4/8 s, manual Retry |
| AC-FEEDIT-06 | S-AB1012-06 | `useBlocker` and `beforeunload` |
| AC-FEEDIT-07 | S-AB1012-07 | `404 NOTE_NOT_FOUND`; `401` to login |
| AC-FEEDIT-08 | S-AB1012-08 | Schema-based paste, no script |
| AC-FEEDIT-09 | S-AB1012-01 | Share and Version history buttons (disabled until AB-1014 and AB-1015) |
| ERR-NOTE-01 | S-AB1012-05 | Title rule and `400 VALIDATION_ERROR` |
| ERR-NOTE-02 to 04, 06 | S-AB1012-07 | 404 and 401 as seen from the UI |

No FRS gap. A-33 (2 s) and A-34 (formatting set) are covered by S-AB1012-03 and S-AB1012-01.

## Test files

| Scenario | File |
| --- | --- |
| S-AB1012-01, S-AB1012-08 | `features/editor/components/note-editor.test.tsx` |
| S-AB1012-02 | `features/editor/components/tag-picker.test.tsx` |
| S-AB1012-03, S-AB1012-04, S-AB1012-05 (page wiring, msw, fake timers) | `features/editor/pages/note-editor-autosave.test.tsx` |
| S-AB1012-06 | `features/editor/components/leave-guard.test.tsx` |
| S-AB1012-07 | `features/editor/pages/note-editor-page.test.tsx` |

Each scenario ID appears in exactly one test title (`check:scenarios`). The state machine itself (debounce restart, coalescing, retry sequence, flush) also gets unit tests in `features/editor/autosave.test.ts` with fake timers, under titles without a scenario ID.
