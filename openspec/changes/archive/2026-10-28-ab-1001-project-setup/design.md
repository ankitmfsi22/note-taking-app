## Context

AB-1001 delivers the foundations that AB-1002 to AB-1016 build on. The binding design is in `docs/SDS.md` (sections 1 to 4, 6, 10 and 11) and `docs/decisions/ADR-0001` to `ADR-0008`. This document records how AB-1001 realised it and the decisions that were made while doing so. The work was done in six batches, each checked with `pnpm build`, `pnpm lint --max-warnings 0` and `pnpm test` before it was committed (Rule 12). See `proposal.md` for why this change is retroactive.

## Decisions

| Decision | Where | Reference |
| --- | --- | --- |
| Layers `routes → controller → service → repository`, `createApp(deps)` with injected `prisma`, `clock`, `env`, `logger` | `backend/src/app.ts`, `backend/src/modules/` | ADR-0001, SDS 1.1 |
| Contract schemas only in `packages/shared`, built with `tsc` to ESM `dist` | `packages/shared` | ADR-0002, SDS 2.3 |
| One error shape; status table typed against the shared `ErrorCode` and compared with SDS 4.3 by a test | `backend/src/common/errors/` | SDS 4, SA-54 |
| Request id: a well-formed client `X-Request-Id` is kept, otherwise a UUID | `backend/src/common/http/request-logging.ts` | SA-54 |
| Logs redact secrets with pino `redact.remove` | `backend/src/common/logger.ts` | SDS 11.8 |
| A stray `ZodError` is a 500 because `validate()` already converts request validation | `backend/src/common/errors/error-middleware.ts` | SA-54 |
| `prisma.config.ts` reads `process.env.DATABASE_URL`, not `env()`, so `prisma generate` works without a database | `backend/prisma.config.ts` | SDS 6.1 |
| Single root `.env`; PostgreSQL 16.15 containers for dev (5432) and test (5433, tmpfs) | `docker-compose.yml`, `.env.example` | SA-41, SA-52 |
| No dependency build scripts are run | `pnpm-workspace.yaml` | SA-53 |
| Vite 8, React 19, Tailwind 4, shadcn `radix-nova`; `fetch` only in `api-client.ts` | `frontend/` | SA-55 |
| `jest-dom` matchers are registered at runtime and typed by a local augmentation, because its Vitest typings clash with Vitest 5 | `frontend/src/test/` | SDS 3.4 |
| Husky pre-commit runs typecheck, lint, tests, tooling tests and spec validation; docs-only commits only check formatting | `scripts/pre-commit.sh` | SA-38, SA-51 |
| commitlint requires a scope and an `AB#` reference | `commitlint.config.mjs` | SA-39 |
| Rule 11 is enforced by lint: `zod` is a type-only import outside shared | `eslint.config.mjs` | SDS 1.1 |
| Change folders are lowercase (`ab-1001-project-setup`) because the OpenSpec CLI rejects uppercase | `openspec/changes/` | SA-56 |
| One test per scenario, enforced by `scripts/check-scenarios.mjs`; scenario IDs are `S-AB1001-nn` | `scripts/`, all test files | SDS 10.3 |

## How the scenarios are tested

- Scenarios about the running API (01 to 09) are backend Vitest tests. The integration tests call `createApp()` through Supertest. Scenario 09 uses the real test database, so `pnpm db:up` must be running.
- Scenario 31 (the loading fallback) is a frontend Vitest test with Testing Library.
- Scenarios about the repository setup and the CI workflow (10 to 30) are `node:test` files in `scripts/` that run under `pnpm test:tooling`. The pre-commit scenarios run `scripts/pre-commit.sh` in a throwaway git repository with a fake `pnpm` on the `PATH`, so the real checks do not run recursively. The lint scenarios lint code from standard input as if it were an existing file.
- No test uses scenario IDs of another ticket. The IDs inside the `check-scenarios` fixtures are built at run time so this repository never matches them.

## Risks and trade-offs

- **`engines.node`.** The root `package.json` says `22.x`. S-AB1001-12 checks dependency versions, `packageManager` and `.nvmrc` (all exact) but not `engines`, which is a compatibility range and not an install pin. The exact Node version is in `.nvmrc`.
- **Slow tooling tests.** The lint scenarios start ESLint with type information several times, so `pnpm test:tooling` takes a few seconds longer. They run in parallel with the other test files.
- **No authorization-denied scenario.** AB-1001 has no protected endpoint, so the guide's authorization-denied scenario does not apply. S-AB1001-06 is the validation-failure scenario.
- **Retroactive scenarios.** They describe behaviour that already existed, so a green run proves the behaviour, not that the scenarios drove the design. The reviewer (`/sdd-review`) should read them for gaps, not only for coverage.
- **Some batch 6 work has no scenario.** The CI workflow's shape and pins have scenarios 29 and 30 (SA-40), and the loading fallback has scenario 31. The Playwright smoke test and `openspec/config.yaml` have none, because the FRS has no acceptance criterion for them; they are verified by the CI run and by review. The workflow was parsed but not linted with `actionlint` (SA-57), so its first CI run is its real validation.

## Migration

None. The Prisma schema has only a generator and a datasource, and `backend/prisma/migrations` does not exist yet. AB-1002 adds the first migration.
