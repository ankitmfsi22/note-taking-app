# backend/CLAUDE.md

Express 5 + TypeScript API. Design: `docs/SDS.md` sections 1, 4 to 8. Root rules in `AGENTS.md` still apply.

## Layout

`src/modules/<name>/` holds `<name>.routes.ts`, `.controller.ts`, `.service.ts`, `.repository.ts` and colocated unit tests. Shared plumbing is in `src/common/` (errors, http helpers, db, security, logger, clock). Integration tests are in `tests/integration/<module>/`.

## Commands

- `pnpm --filter backend run dev | build | typecheck | test | test --coverage`
- `pnpm --filter backend run prisma:generate`, `prisma migrate dev --create-only` (always review the SQL before applying)
- `pnpm --filter backend run job:purge` runs the trash purge once

## Patterns

- Routes validate with a shared Zod schema through `validate()` and store the result in `res.locals` (`req.query` is read-only in Express 5).
- Controllers map HTTP to a DTO and back. No business rules, no Prisma.
- Services hold rules and transactions. They throw `AppError(code)`; the error middleware maps code to status from the SDS table.
- Repositories are the only Prisma users. Method names state the scope: `findActiveByIdForUser`, `listTrashedForUser`. No unscoped `findById`. Every method takes `userId`.
- Raw SQL is a `$queryRaw` tagged template. Add `"deletedAt" IS NULL` yourself.
- Time-dependent logic takes the injected `Clock`, never `new Date()` in a service.
- Prisma 7: client from `src/generated/prisma` with the `PrismaPg` adapter. Do not edit generated files.
- ESM NodeNext: relative imports end in `.js`.

## Tests

- Integration tests call `createApp(deps)` through Supertest on `noteapp_test` (port 5433). The DB is truncated before each test.
- Assert the exact status and `error.code` from SDS section 7. Cover ownership (other user gets 404) and validation (400) for every endpoint.
- Test titles start with `S-AB<ticket>-<nn>`.

## Anti-patterns

- Prisma in a service or controller. A query without `userId`.
- A response status or error code not listed in SDS section 7.
- `try/catch` that only rethrows. `console.log` (use pino). Logging tokens, passwords or OTP hashes.
- Importing `src/testing/otp-test-sink.ts` outside the `NODE_ENV=test` branch of `server.ts`.
