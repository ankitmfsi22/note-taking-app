# Tasks: AB-1006 tags

Every checkpoint: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm format:check`, `pnpm test`; never continue past a failure. Tests come before the code they prove. Support tests carry no scenario ID.

## 1. Shared contracts

- [x] 1.1 Support tests for the tag request, params, list and `SetNoteTagsRequestSchema` (trim, colour, at-least-one, de-dup then max 10) and `NoteResponse` with tags
- [x] 1.2 Limits, tag schemas, `NoteResponseSchema.tags`, `types.ts`
- [x] 1.3 Checkpoint

## 2. Tag CRUD

- [ ] 2.1 Test `S-AB1006-01` create and list with note counts ignoring soft-deleted notes
- [ ] 2.2 Test `S-AB1006-02` duplicate name in any case returns 409
- [ ] 2.3 Test `S-AB1006-03` invalid input returns 400
- [ ] 2.4 Test `S-AB1006-04` other user's tag or note 404, no token 401
- [ ] 2.5 Test `S-AB1006-05` rename, recolour, delete
- [ ] 2.6 Tags repository, service, controller, routes; mount in `app.ts`
- [ ] 2.7 Checkpoint

## 3. Note tags

- [ ] 3.1 Test `S-AB1006-06` replace the whole set; support test that `NoteResponse.tags` is filled on GET
- [ ] 3.2 `setForNote` transaction, `PUT /notes/:noteId/tags`, notes reads include tags
- [ ] 3.3 Checkpoint

## 4. Verification

- [ ] 4.1 `pnpm test --coverage` at least 80% on new code
- [ ] 4.2 `pnpm check:scenarios` and `pnpm spec:validate`
- [ ] 4.3 Compare `delta-openapi.yaml` with the implemented statuses and codes
