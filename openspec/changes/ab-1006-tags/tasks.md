# Tasks: AB-1006 tags

Every checkpoint: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm format:check`, `pnpm test`; never continue past a failure. Tests come before the code they prove. Support tests carry no scenario ID.

## 1. Shared contracts

- [x] 1.1 Support tests for the tag request, params, list and `SetNoteTagsRequestSchema` (trim, colour, at-least-one, de-dup then max 10) and `NoteResponse` with tags
- [x] 1.2 Limits, tag schemas, `NoteResponseSchema.tags`, `types.ts`
- [x] 1.3 Checkpoint

## 2. Tag CRUD

- [x] 2.1 Test `S-AB1006-01` create and list with note counts ignoring soft-deleted notes
- [x] 2.2 Test `S-AB1006-02` duplicate name in any case returns 409
- [x] 2.3 Test `S-AB1006-03` invalid input returns 400
- [x] 2.4 Test `S-AB1006-04` other user's tag or note 404, no token 401
- [x] 2.5 Test `S-AB1006-05` rename, recolour, delete
- [x] 2.6 Tags repository, service, controller, routes; mount in `app.ts`
- [x] 2.7 Checkpoint

## 3. Note tags

- [x] 3.1 Test `S-AB1006-06` replace the whole set; support test that `NoteResponse.tags` is filled on GET
- [x] 3.2 `setNoteTags` transaction, `PUT /notes/:noteId/tags`, notes reads include tags
- [x] 3.3 Checkpoint

## 4. Verification

- [x] 4.1 `pnpm test --coverage` at least 80% on new code
- [x] 4.2 `pnpm check:scenarios` and `pnpm spec:validate`
- [x] 4.3 Compare `delta-openapi.yaml` with the implemented statuses and codes
