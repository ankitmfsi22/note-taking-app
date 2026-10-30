## Why

`docs/api/openapi.yaml` is the contract of the 28 endpoints in SDS section 7.1, but nobody can browse it or try a call, and nothing stops it drifting from the Express routes. This change completes and corrects the document, serves it as Swagger UI, and adds a test that fails when a registered route is missing from it. It is an AB-1016 final-polish change; the FRS has no requirement for it, so it is traced to SDS section 7 and SA-44 (the OpenAPI file is a binding artefact).

## What Changes

- `docs/api/openapi.yaml`: corrections against the real routes and shared Zod schemas (strict request objects, `413 PAYLOAD_TOO_LARGE` and `MALFORMED_JSON` on body endpoints, shared path parameters, response typing), tag descriptions, and request, response and error examples so "Try it out" pre-fills useful bodies. No endpoint, status or error code changes.
- Backend serves Swagger UI at `/api/docs` and the raw spec as JSON at `/api/docs/openapi.json` (swagger-ui-express, `yaml` for parsing).
- New env flag `API_DOCS_ENABLED` (default `true` in development and test, `false` in production). Off means the docs routes are not mounted and answer the normal `404 ROUTE_NOT_FOUND`.
- Helmet's CSP differs for `/api/docs` only by dropping `upgrade-insecure-requests` (Helmet's default already allows what Swagger UI needs); every other route keeps the default.
- Tests: the spec is valid OpenAPI 3.1 (`@apidevtools/swagger-parser`), and the set of routes registered on the real app equals the set of operations in the spec.
- README: API docs section, `API_DOCS_ENABLED` in the env table, features, API overview and status.

## FRS coverage

No FRS requirement is added or changed. Traceability: SDS section 7.1 (28 endpoints), SDS SA-44 (OpenAPI is maintained with the change), SDS section 4 (error contract), AGENTS.md architecture rule 4 (dependency injection: `createApp` receives `env`).

| Source | Scenarios |
| --- | --- |
| SDS 7.1 every endpoint documented | S-AB1016-06, S-AB1016-07 |
| SA-44 spec stays valid and in sync | S-AB1016-06, S-AB1016-07 |
| Docs off in production, env flag | S-AB1016-08, S-AB1016-11 |
| Docs public, API unchanged | S-AB1016-09, S-AB1016-10 |
| CSP adjusted only for docs | S-AB1016-12 |

Authorization-denied: S-AB1016-10 (`GET /api/v1/notes` still `401 UNAUTHORIZED`). Validation failure: S-AB1016-11 (an invalid `API_DOCS_ENABLED` fails startup validation) and S-AB1016-10 (`400 VALIDATION_ERROR` unchanged).

## Assumptions to confirm

- **[ASSUMPTION — confirm]** The senior waived the approval gates for this change; no `approvals.md` is recorded.
- **[ASSUMPTION — confirm]** "Try it out" on `/auth/refresh` and `/auth/logout` from Swagger UI returns `403 FORBIDDEN_ORIGIN` unless `APP_ORIGIN` equals the API origin, because the Origin check is unchanged. The spec says so.
- **[ASSUMPTION — confirm]** There is no Docker image in the repository. A future production image that enables the docs must copy `docs/api/openapi.yaml`; with the flag off (the production default) the file is never read.

## Out of scope

Generating the spec from Zod, request/response contract testing against the spec, changing any API behaviour, a hosted docs site.

## Impact

`docs/api/openapi.yaml`, `backend/src/modules/docs/`, `backend/src/app.ts`, `backend/src/config/env.ts`, `.env.example`, `README.md`, backend dependencies (`swagger-ui-express`, `yaml`, dev: `@apidevtools/swagger-parser`, `@types/swagger-ui-express`). Capability `api-docs` (new). No endpoint, schema or error code changes.

## Rollback

Revert the commits; the flag can also be set to `false`.
