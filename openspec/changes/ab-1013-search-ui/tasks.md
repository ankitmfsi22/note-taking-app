## Tasks: AB-1013

### Phase 1 - highlight parser and API (tests first)
- [x] 1.1 `highlight.test.ts`, `highlight.ts` (15 min)
- [x] 1.2 `api.ts`, `queries.ts` (10 min)
- [x] 1.3 Checkpoint: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test`

### Phase 2 - components and mount (tests first)
- [ ] 2.1 Tests S-AB1013-01 to S-AB1013-06 in `search-section.test.tsx` (40 min)
- [ ] 2.2 `highlighted-text.tsx`, `search-results.tsx`, `search-section.tsx`, mount in `notes-placeholder.tsx` (30 min)
- [ ] 2.3 Checkpoint: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test`

### Phase 3 - final
- [ ] 3.1 `pnpm test --coverage`, `pnpm check:scenarios`, `pnpm spec:validate`; run the reviewer agent

| Requirement / scenario | Task |
| --- | --- |
| Highlight (S-AB1013-02) | 1.1, 2.1 |
| Debounce, result opens note (S-AB1013-01) | 2.1, 2.2 |
| Pagination, empty (S-AB1013-03) | 2.1, 2.2 |
| Clearing (S-AB1013-04) | 2.1, 2.2 |
| Errors and retry (S-AB1013-05) | 2.1, 2.2 |
| 401 (S-AB1013-06) | 2.1, 2.2 |
