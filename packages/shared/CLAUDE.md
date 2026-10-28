# packages/shared/CLAUDE.md

The contract package. Every Zod schema, inferred type and limit constant for the API lives here and nowhere else (Rule 11). Design: `docs/SDS.md` sections 4, 7.2 and 2.3.

## Layout

`src/schemas/` holds `common.ts`, `auth.ts`, `note.ts`, `tag.ts`, `search.ts`, `share.ts`, `version.ts`, `health.ts` and `tiptap.ts`. `src/constants/limits.ts` holds the numeric limits the schemas use. `src/types.ts` exports `z.infer` types. `src/index.ts` is the barrel.

## Commands

- `pnpm --filter @note-app/shared run build` (tsc to `dist/`, ESM), `typecheck`, `test`
- Backend and frontend import the built `dist`. Run `pnpm build` after changing a schema.

## Patterns

- Name schemas as in SDS section 7.2: `RegisterRequestSchema`, `AuthResponseSchema`, `NoteResponseSchema`. The inferred type drops the `Schema` suffix.
- Export the schema and its `z.infer` type together. Do not hand-write an interface that mirrors a schema.
- Error codes are one `ErrorCode` enum in `common.ts`. It must match the 17 codes in SDS section 4.3 and `docs/api/openapi.yaml`.
- Limits (`TITLE_MAX`, `TRASH_RETENTION_DAYS`, `VERSION_KEEP`) are constants imported by schemas and by services, so a value is defined once.
- Zod 4 API only. Check Context7 before using a method you have not used here.
- ESM NodeNext: relative imports end in `.js`.

## Tests

Unit tests per schema: one valid case and one rejected case per rule. Test titles start with `S-AB<ticket>-<nn>` when they prove a spec scenario.

## Anti-patterns

- Business logic, Prisma types, React code or Express types in this package.
- Declaring a request or response type in `backend/` or `frontend/`.
- Changing a schema or error code without updating the SDS and `docs/api/openapi.yaml` in the same change.
- Importing from `backend` or `frontend` (dependencies point one way: they depend on shared).
