---
name: add-endpoint
description: Add a REST endpoint to the backend in the project's layered way (shared schema, repository, service, controller, route, integration test). Use when implementing an endpoint from docs/SDS.md section 7.
---

# Add an endpoint

Only for an endpoint in an approved spec. The contract is in `docs/SDS.md` section 7.1, and its status and error codes are binding.

1. **Schema first, in `packages/shared`.** Add or reuse the request, query, params and response schemas named in SDS 7.2. Export the inferred types. Build the package (`pnpm --filter @note-app/shared run build`).
2. **Repository** (`backend/src/modules/<name>/<name>.repository.ts`). Name the method by its scope, for example `findActiveByIdForUser`. It takes `userId` and puts it in the `WHERE`. Raw SQL only as a `$queryRaw` tagged template with `"deletedAt" IS NULL` written out.
3. **Service.** Business rules, transactions, `throw new AppError('<CODE>')` from the SDS code table. Time from the injected `Clock`.
4. **Controller.** Reads `req.body`, `res.locals` and `req.userId`; returns the status from SDS section 7 and parses the response with the shared schema. No rules, no Prisma.
5. **Route.** `validate(schema)` first, then `requireAuth` when the endpoint is not public, then the controller. Register it in the module's router and in `createApp`. Declare static paths before parameterised ones (`/notes/trash` before `/notes/:noteId`).
6. **Tests.** One integration test per scenario in `backend/tests/integration/<module>/`, titled `S-AB<ticket>-<nn>: ...`. Include success, validation failure, unauthenticated, and another user's resource returning 404.
7. **OpenAPI.** Make sure the path in the ticket's `delta-openapi.yaml` matches what you built.

Verify Express and Prisma calls with Context7 before using them. Express 5 note: `req.query` is read-only.
