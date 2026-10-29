## Tasks: AB-1014

### Phase 1: data layer and shared pieces
- [x] 1.1 `features/sharing/api.ts`, `queries.ts` (15 min)
- [x] 1.2 `components/confirm-dialog.tsx` (10 min)
- [x] 1.3 `components/tiptap-view.tsx` + test for S-AB1014-04 rendering (25 min)
- [x] 1.4 Checkpoint: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test`

### Phase 2: share modal
- [x] 2.1 Test S-AB1014-01 (create, past expiry, copy, server 400) (25 min)
- [x] 2.2 Test S-AB1014-02 (revoke confirm, cancel, 404) (15 min)
- [x] 2.3 `share-modal.tsx`, `share-link-row.tsx`, `share-button.tsx` (35 min)
- [x] 2.4 Checkpoint: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test`

### Phase 3: pages and routes
- [ ] 3.1 Tests S-AB1014-03, 04, 05, 06 (35 min)
- [ ] 3.2 `shares-page.tsx`, `public-share-page.tsx`, `public-layout.tsx`, `router.ts` (35 min)
- [ ] 3.3 Checkpoint: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test`

### Phase 4: finish
- [ ] 4.1 `pnpm test --coverage` (>= 80% new code), `pnpm check:scenarios`, `pnpm spec:validate`
- [ ] 4.2 Smoke test happy path and error scenarios (tests cover them); run reviewer pass

No `[PARALLEL]` tasks (single frontend feature).

| Requirement | Tasks |
| --- | --- |
| Share modal creates and lists links | 2.1, 2.3 (S-AB1014-01) |
| Revoke one link | 2.2, 2.3 (S-AB1014-02) |
| Active links page | 3.1, 3.2 (S-AB1014-03) |
| Public shared note page | 1.3, 3.1, 3.2 (S-AB1014-04) |
| Unavailable link state | 3.1, 3.2 (S-AB1014-05) |
| Share endpoints need a session | 3.1, 3.2 (S-AB1014-06) |
