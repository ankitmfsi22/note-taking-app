## Design: AB-1014 share UI (frontend only)

No shared schema, backend, migration or SDS change. All schemas come from `@note-app/shared`.

### Files (all under `frontend/src/`)

| File | Purpose |
| --- | --- |
| `features/sharing/api.ts` | `createShare`, `listNoteShares`, `listActiveShares`, `revokeShare` through `apiFetch`; `getPublicShare` with `auth: false` |
| `features/sharing/queries.ts` | query keys, `useNoteShares`, `useActiveShares`, `useCreateShare`, `useRevokeShare` (invalidate both lists), `usePublicShare` (`retry: false`) |
| `components/confirm-dialog.tsx` | shared `ConfirmDialog` built on `AlertDialog` from `radix-ui` (not yet present in the repo) |
| `features/sharing/components/share-modal.tsx` | `Dialog` with the create form (react-hook-form + `CreateShareLinkRequestSchema`) and the link list |
| `features/sharing/components/share-link-row.tsx` | status badge, expiry, views, Copy (clipboard + "Copied"), Revoke |
| `features/sharing/components/share-button.tsx` | minimal mount point: button that opens the modal for a `noteId` (the editor of AB-1012 mounts it) |
| `features/sharing/components/tiptap-view.tsx` | renders TipTap JSON as React elements, allow-listed nodes and marks, safe link hrefs only |
| `features/sharing/pages/shares-page.tsx` | `/shares`, `page` in the URL |
| `features/sharing/pages/public-share-page.tsx` | `/s/:token` |
| `routes/public-layout.tsx`, `routes/router.ts` | `PublicLayout`; routes `/shares` (inside `require-auth`) and `/s/:token` (no guard) |

### Requirement mapping

- AC-FESHARE-01 to 03: modal form. The datetime-local value is converted to ISO and checked with the shared schema, then a future/365-day check in the form (the schema cannot do the range; the server stays authoritative and its `VALIDATION_ERROR` details are mapped onto the field). Rows show `<origin>/s/<token>`.
- AC-FESHARE-04, ERR-SHARE-01/03/04: `ConfirmDialog` before `revokeShare`; 404 shows a message and refetches.
- AC-FESHARE-05: `/shares` with loading, empty, error+retry states.
- AC-FESHARE-06/07: public page, `apiFetch(..., { auth: false })` so no Bearer header and no refresh; any error shows one generic state; `TiptapView` never uses `innerHTML`.
- ERR-SHARE-08: owner calls use default `auth: true`; a failed refresh clears the session and `AppShell` navigates to `/login`.

### Risks and tests

- XSS: test renders `<script>` text and a `javascript:` link mark; asserts literal text, no script element, no anchor.
- Privacy: test asserts no `authorization` header on the public request and no owner data in the DOM.
- Stale lists after revoke: mutation invalidates both query families; tests assert the refetched UI.
- [ASSUMPTION — confirm] `ConfirmDialog` lives in `components/` because no shared one exists yet; AB-1011/1012 should reuse it.
