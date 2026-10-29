# Tasks: AB-1008 sharing

Every checkpoint: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm format:check`, `pnpm test`. Tests come before the code they prove. Support tests carry no scenario ID.

## 1. Shared contracts

- [x] 1.1 Support tests for the share schemas (token pattern, expiry parsing, params)
- [x] 1.2 `share.ts`, `limits.ts`, `types.ts`, `index.ts`
- [x] 1.3 Checkpoint

## 2. Database

- [x] 2.1 `ShareLink` model and `sharing_share_link` migration (create-only, review SQL, apply, generate)
- [x] 2.2 Checkpoint

## 3. Owner endpoints

- [ ] 3.1 Test `S-AB1008-01` create two links
- [ ] 3.2 Test `S-AB1008-03` revoke idempotent and lists
- [ ] 3.3 Test `S-AB1008-05` ownership 404 and 401
- [ ] 3.4 Test `S-AB1008-06` validation 400
- [ ] 3.5 Repository, service, controller, routes, `app.ts` (owner routes)
- [ ] 3.6 Checkpoint

## 4. Public read

- [ ] 4.1 Test `S-AB1008-02` read-only view and 50 concurrent views
- [ ] 4.2 Test `S-AB1008-04` indistinguishable 404 and restore
- [ ] 4.3 Atomic `UPDATE ... RETURNING`, public route and headers
- [ ] 4.4 Checkpoint

## 5. Verification

- [ ] 5.1 `pnpm test --coverage` at least 80% on new code
- [ ] 5.2 `pnpm check:scenarios` and `pnpm spec:validate`
- [ ] 5.3 Compare `delta-openapi.yaml` with the implemented statuses and codes
