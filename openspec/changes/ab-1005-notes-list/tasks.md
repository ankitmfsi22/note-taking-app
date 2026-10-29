# Tasks: AB-1005 notes list

Every checkpoint: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm format:check`, `pnpm test`; never continue past a failure. Tests come before the code they prove. Support tests carry no scenario ID.

## 1. Shared contracts

- [x] 1.1 Support tests for `NoteListQuerySchema` (defaults, coercion, each rejected rule, de-duplication) and `NoteListResponseSchema`
- [x] 1.2 `LIST_TAG_IDS_MAX`, `TAG_NAME_MAX`, `tag.ts` (`TagResponseSchema`), note list schemas, `types.ts`, `index.ts`
- [x] 1.3 Checkpoint

## 2. Database

- [x] 2.1 `Tag`, `NoteTag` and the two `Note` indexes; migration `notes_list_tags` (create-only, review SQL, apply, generate)
- [x] 2.2 Checkpoint

## 3. List endpoint

- [x] 3.1 Test `S-AB1005-01` default first page and page beyond the last
- [x] 3.2 Test `S-AB1005-02` sort by title ascending, ties by id
- [x] 3.3 Test `S-AB1005-03` invalid query returns 400
- [x] 3.4 Test `S-AB1005-04` no token 401, other users' notes never listed
- [x] 3.5 Test `S-AB1005-05` soft-deleted notes excluded from items and totals
- [x] 3.6 Test `S-AB1005-06` OR tag filter once each, foreign tag 404
- [x] 3.7 Repository `listActiveForUser`, `countTagsForUser`; service `list`; controller; route `GET /`
- [x] 3.8 Checkpoint

## 4. Verification

- [ ] 4.1 `pnpm test --coverage` at least 80% on new code
- [ ] 4.2 `pnpm check:scenarios` and `pnpm spec:validate`
- [ ] 4.3 Compare `delta-openapi.yaml` with the implemented statuses and codes
