# Tasks: AB-1007 full-text search

Every checkpoint: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm format:check`, `pnpm test`; never continue past a failure. Tests come before the code they prove. Support tests carry no scenario ID.

## 1. Shared contracts

- [x] 1.1 Support tests for the search schemas (q trim, min, max; pagination)
- [x] 1.2 `limits.ts`, `search.ts`, `types.ts`, `index.ts`
- [x] 1.3 Checkpoint

## 2. Database

- [ ] 2.1 `searchVector` field, `notes_search_vector` migration (create-only, hand-edit SQL, apply, generate, no drift)
- [ ] 2.2 Checkpoint

## 3. Search endpoint

- [ ] 3.1 Unit test for `escape-highlight.ts`
- [ ] 3.2 Tests `S-AB1007-01` to `S-AB1007-06`
- [ ] 3.3 `escape-highlight.ts`, repository, service, controller, routes, `app.ts`
- [ ] 3.4 Checkpoint

## 4. Verification

- [ ] 4.1 `pnpm test --coverage` at least 80% on new code
- [ ] 4.2 `pnpm check:scenarios` and `pnpm spec:validate`
- [ ] 4.3 Compare `delta-openapi.yaml` with the implemented statuses and codes
