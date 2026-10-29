## Tasks (tests first; each under 45 minutes; no `[PARALLEL]`, frontend only)

- [x] 1.1 Tests for S-AB1015-01, 03, 04, 06 with msw (read paths and errors) (40 min)
- [x] 1.2 `api.ts`, `queries.ts` (20 min)
- [x] 1.3 `version-preview.tsx`, `version-drawer.tsx`: list, states, paging, latest blocked (40 min)
- [x] 1.4 Checkpoint: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test`
- [x] 2.1 Tests for S-AB1015-02, 05 (flush order, flush failure) (30 min)
- [x] 2.2 Restore flow with `flush()`, confirm, `onRestored` (30 min)
- [x] 2.3 Mount "History" button and drawer on the editor page (15 min)
- [x] 2.4 Final checkpoint: build, lint, `pnpm test --coverage` (>= 80%), `pnpm spec:validate`, `pnpm check:scenarios`

| Spec scenario | Task |
| --- | --- |
| S-AB1015-01, 03, 04, 06 | 1.1, 1.3 |
| S-AB1015-02, 05 | 2.1, 2.2 |

Blocked until AB-1012 is merged.
