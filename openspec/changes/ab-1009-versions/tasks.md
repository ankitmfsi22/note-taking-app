# Tasks: AB-1009 version history

Every checkpoint: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm format:check`, `pnpm test`. Tests come first. Support tests carry no scenario ID.

## 1. Shared contracts

- [ ] 1.1 Support tests for the version schemas and `latestVersion`
- [ ] 1.2 `VERSION_KEEP`, `version.ts`, `note.ts`, `types.ts`, `index.ts`
- [ ] 1.3 Checkpoint

## 2. Database

- [ ] 2.1 `NoteVersion`, `Note.lastVersionNumber`, migration `versions_note_version` with backfill (create-only, review SQL, apply, generate)
- [ ] 2.2 Checkpoint

## 3. Save transaction

- [ ] 3.1 Test `S-AB1009-01` snapshot and identical save
- [ ] 3.2 Test `S-AB1009-04` keep the newest 50
- [ ] 3.3 Notes repository and service: locked save step, version 1 on create, `latestVersion` in the response
- [ ] 3.4 Checkpoint

## 4. Version endpoints

- [ ] 4.1 Tests `S-AB1009-02`, `-03`, `-05`, `-06`
- [ ] 4.2 Versions repository, service, controller, routes, `app.ts`
- [ ] 4.3 Checkpoint

## 5. Verification

- [ ] 5.1 `pnpm test --coverage` at least 80% on new code
- [ ] 5.2 `pnpm check:scenarios` and `pnpm spec:validate`
- [ ] 5.3 Compare `delta-openapi.yaml` with the implementation
