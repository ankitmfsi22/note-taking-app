# Tasks: AB-1004 notes CRUD and soft delete

Every checkpoint: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm format:check`, `pnpm test`; never continue past a failure. Tests come before the code they prove. Support tests carry no scenario ID.

## 1. Shared contracts

- [x] 1.1 Support tests for `TipTapDocSchema`, pagination and note schemas (one accepted and one rejected case per rule)
- [x] 1.2 `limits.ts`, `tiptap.ts`, `common.ts` pagination, `note.ts`, `types.ts`, `index.ts`
- [x] 1.3 Checkpoint

## 2. Database

- [x] 2.1 `Note` model and `notes_note` migration (create-only, review SQL, apply, generate)
- [x] 2.2 Checkpoint

## 3. Notes endpoints

- [ ] 3.1 Test `S-AB1004-01` create, read and update
- [ ] 3.2 Test `S-AB1004-02` invalid input returns 400
- [ ] 3.3 Test `S-AB1004-03` other user's or missing note returns 404
- [ ] 3.4 Test `S-AB1004-04` no token 401, malformed id 400
- [ ] 3.5 Test `S-AB1004-05` soft delete, trash list, restore
- [ ] 3.6 `content-text.ts` (with unit test), `validParams`/`validQuery`, repository, service, controller, routes, `app.ts`
- [ ] 3.7 Checkpoint

## 4. Trash purge

- [ ] 4.1 Test `S-AB1004-06` restore and purge at the 30-day boundary
- [ ] 4.2 `TrashPurgeJob`, purge repository, scheduler (unit test with fake timers), `JOBS_ENABLED`, `server.ts`, `purge-cli.ts`, `job:purge`
- [ ] 4.3 Checkpoint

## 5. Verification

- [ ] 5.1 `pnpm test --coverage` at least 80% on new code
- [ ] 5.2 `pnpm check:scenarios` and `pnpm spec:validate`
- [ ] 5.3 Compare `delta-openapi.yaml` with the implemented statuses and codes
