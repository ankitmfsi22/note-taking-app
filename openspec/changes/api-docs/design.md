## Approach

A small backend module `modules/docs/` loads `docs/api/openapi.yaml`, converts it once with `yaml`, and exposes a router: `GET /openapi.json` plus `swagger-ui-express` (`serve`, `setup`). `createApp` mounts it at `/api/docs` only when `deps.env.API_DOCS_ENABLED` is true. The YAML stays the source of truth; the JSON is derived.

## Decisions

- **Spec location.** The path is resolved from `import.meta.url` as `../../../../docs/api/openapi.yaml`. `src/modules/docs/` (tsx) and `dist/modules/docs/` (built) have the same depth under `backend/`, so one relative path works in both. The file is read only when the flag is on. There is no Docker image in the repo; a future one must copy `docs/api/openapi.yaml` or keep the flag off (the production default).
- **DI.** `createApp` already receives `env`. It also accepts an optional `openApiDocument` dep (tests pass none and get the real file); the docs module never imports `env`.
- **Mounting order.** The docs router is mounted after the request logger and before the global Helmet and `express.json`, with its own Helmet whose CSP is the default minus `upgrade-insecure-requests`, which breaks Swagger UI over plain http. Helmet's default already allows inline styles, same-origin scripts and data: images, so nothing else is relaxed. Routes outside `/api/docs` keep the strict policy. Docs are outside `/api/v1`, so the origin check (only on refresh and logout) and `requireAuth` never see them. When the flag is off nothing is mounted and the normal `notFoundHandler` returns `404 ROUTE_NOT_FOUND`.
- **Server URL.** `/api/v1` is relative, so "Try it out" calls the same origin that served the UI; no CORS is involved. Refresh and logout from the UI carry `Origin: http://localhost:3000`, which differs from `APP_ORIGIN`, so they return `403 FORBIDDEN_ORIGIN` unless `APP_ORIGIN` is the API origin. Behaviour is not changed; the YAML documents it.
- **Env flag.** `API_DOCS_ENABLED` is an optional `'true' | 'false'` string. A final transform on the Env schema resolves the default from `NODE_ENV` and yields a boolean (documented exception to "zod only in shared": the `Env` schema, AGENTS.md).
- **Validator.** `@apidevtools/swagger-parser` 13.1.0 (dev dependency, API checked with Context7) validates OAS 3.1 in a test.
- **Route-coverage test.** The routes come from walking the real `createApp(...)` router stack (`app.router.stack`, descending into mounted routers and rebuilding the mount path from the layer regexp / `matchers`), with the unusable-Prisma test double, so no database is needed. `:param` becomes `{param}`.

## Tests

| File | Scenarios |
| --- | --- |
| `backend/tests/integration/api-docs/openapi-spec.test.ts` | S-AB1016-06, S-AB1016-07 |
| `backend/tests/integration/api-docs/docs.test.ts` | S-AB1016-08, S-AB1016-09, S-AB1016-10, S-AB1016-12 |
| `backend/src/config/env.test.ts` | S-AB1016-11 |

These tests never touch the database (the Prisma double throws if used), so they are safe to run beside other suites.
