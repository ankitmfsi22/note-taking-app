## 1. Planning and context (done)

- [x] 1.1 Reference documents committed (`48cbc32`)
- [x] 1.2 FRS written, revised and approved (`e29d14a`)
- [x] 1.3 SDS, ADR-0001 to ADR-0008 and the OpenAPI baseline approved (`c16c263`)
- [x] 1.4 `AGENTS.md`, `CLAUDE.md` and the three layer `CLAUDE.md` files (`127f4f0`)
- [x] 1.5 `.claude` settings, hooks, commands, agents and skills (`b1126ed`)

## 2. Batch 1: root tooling (done, `244ca26`)

- [x] 2.1 pnpm workspace, `.nvmrc`, exact pins, `tsconfig.base.json`
- [x] 2.2 ESLint flat config, Prettier, `.prettierignore`
- [x] 2.3 Husky pre-commit and commit-msg, `scripts/pre-commit.sh`
- [x] 2.4 commitlint with `AB#` references, and its config test
- [x] 2.5 Checkpoint: build, lint, test, typecheck, format

## 3. Batch 2: packages/shared (done, `3632d1c`)

- [x] 3.1 Package with ESM build, `zod`, Vitest and coverage thresholds
- [x] 3.2 `IdSchema`, `ErrorCodeSchema`, `ErrorResponseSchema`, `HealthResponseSchema`
- [x] 3.3 Drift test: `ErrorCode` equals the SDS table and `docs/api/openapi.yaml`
- [x] 3.4 Checkpoint: build, lint, test with coverage

## 4. Batch 3: backend package and databases (done, `8169dec`)

- [x] 4.1 `docker-compose.yml` with PostgreSQL 16.15 for dev and test, `.env.example`
- [x] 4.2 Prisma 7 configuration and the pg-adapter client factory
- [x] 4.3 Root `postinstall`, `db:up` and `db:down` scripts
- [x] 4.4 Checkpoint, plus a connection check against all three databases

## 5. Batch 4: Express app (done, `4a85062`)

- [x] 5.1 Environment validation, clock, logger with redaction
- [x] 5.2 `AppError`, status table, error middleware, `validate()`
- [x] 5.3 Request id and request logging
- [x] 5.4 `createApp(deps)`, `server.ts` and `GET /api/v1/health`
- [x] 5.5 Backend ESLint block: Prisma import limits, no `console`, no unsafe raw SQL
- [x] 5.6 Tests: unit, health integration and the database connection
- [x] 5.7 Checkpoint, plus a smoke test of the built server and of the dev path

## 6. Batch 5: frontend shell (done, `1aa4c2c`)

- [x] 6.1 Vite 8, React 19, Tailwind 4, shadcn `radix-nova` (generated in a scratch copy)
- [x] 6.2 `apiFetch`, query client, router with lazy routes, health status page
- [x] 6.3 Vitest with jsdom, Testing Library, msw and the jest-dom typing fix
- [x] 6.4 Frontend ESLint block: no raw `fetch`, no HTML injection
- [x] 6.5 Checkpoint, plus a smoke test of Vite with the proxy to the backend

## 7. Spec, guard and scenario tooling (done in this step)

- [x] 7.1 Rule 11 lint guard for `zod`
- [x] 7.2 Lowercase change-folder naming in the commands, the skill and the SDS (SA-56)
- [x] 7.3 `scripts/check-scenarios.mjs` and its tests
- [x] 7.4 Scenario IDs on the nine existing backend tests
- [x] 7.5 Tooling tests for scenarios 10 to 25
- [x] 7.6 This change: proposal, specs, design, tasks and `delta-openapi.yaml`
- [x] 7.7 Human approvals: spec, plan and tasks recorded in `approvals.md` (2026-10-28)

## 8. Batch 6: remaining AB-1001 work

- [x] 8.1 `e2e/` package: Playwright config for Chromium with one worker, database reset fixture for `noteapp_e2e`, and a smoke test that loads the home page through the Vite proxy
- [x] 8.2 `test:e2e` root script and the ESLint and Prettier ignores for Playwright output
- [x] 8.3 `.github/workflows/ci.yml` with the `verify`, `commits`, `security` and `e2e` jobs and every action pinned to a full commit SHA (SA-40), plus `scripts/ci-workflow.test.mjs`
- [x] 8.4 Fill `openspec/config.yaml` with the project context, per-artifact rules and apply and archive guidance
- [x] 8.5 Fix found by the e2e run: a `HydrateFallback` for the lazy routes, with a test
- [x] 8.6 Checkpoint: build, lint, test with coverage, tooling tests, `check:scenarios`, `spec:validate`, `test:e2e`

## 9. Close the ticket

- [ ] 9.1 `/sdd-review ab-1001` in a fresh terminal shows all ✅
- [ ] 9.2 Archive the change: `pnpm exec openspec archive ab-1001-project-setup --yes`
- [ ] 9.3 Open the pull request with every FRS requirement and scenario listed (Rule 19)
