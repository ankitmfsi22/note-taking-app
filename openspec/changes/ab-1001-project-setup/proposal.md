## Why

AB-1001 sets up the project: the monorepo, the database, the quality gates, the AI context and the health endpoint every later ticket builds on. Every later ticket depends on these foundations, so they need a written, testable specification like any other ticket (Rule 1).

## Retroactive note

**This change is retroactive.** Rule 1 requires an approved spec before any code, but the `/spec`, `/sdd-plan`, `/sdd-tasks`, `/approve` commands and the OpenSpec conventions that this process uses were built *inside* AB-1001, so they did not exist when the work started. The foundations were first specified in `docs/FRS.md` (AC-SETUP-01 to 07, approved), `docs/SDS.md` (approved) and `docs/decisions/ADR-0001` to `ADR-0008`. This change was written after batches 1 to 5 were implemented and committed, to bring AB-1001 under the same rules as AB-1002 to AB-1016: a delta spec with named scenarios, one test per scenario, a design, a task list, and review.

The scenarios below were written to match behaviour that already exists, and each one has a test (`pnpm check:scenarios` proves it). From AB-1002 on, the spec comes first.

## What Changes

- Adds the pnpm workspace (`backend`, `frontend`, `packages/shared` and `e2e`) with exact dependency versions (batches 1 to 6, done).
- Adds PostgreSQL 16 for development and tests through `docker-compose.yml`, and Prisma 7 with the pg adapter (batch 3, done).
- Adds the Express 5 app shell: request logging with redaction, the single error response shape, input validation, and `GET /api/v1/health` (batch 4, done).
- Adds the Vite, React 19, Tailwind 4 and shadcn frontend shell with Testing Library and msw (batch 5, done).
- Adds the quality gates: root `build`, `lint`, `test`, 80% coverage thresholds, Husky pre-commit, commitlint with `AB#`, and the Rule 11 lint guard (batches 1 to 5, done).
- Adds the AI context: `AGENTS.md`, `CLAUDE.md`, three layer files, `.claude/` commands, agents, skills and hooks, and the Context7 MCP server (done).
- Adds `scripts/check-scenarios.mjs`, which enforces one test per scenario (done in this step).
- Adds the Playwright `e2e/` package with a smoke test, the GitHub Actions workflow with commit-SHA-pinned actions, a loading fallback for the lazy routes, and the filled `openspec/config.yaml` (batch 6, done).

## FRS coverage

| FRS requirement | Scenarios |
| --- | --- |
| AC-SETUP-01 workspace | S-AB1001-11 |
| AC-SETUP-02 Prisma on PostgreSQL 16 | S-AB1001-09, S-AB1001-10 |
| AC-SETUP-03 exact versions | S-AB1001-12 |
| AC-SETUP-04 AGENTS.md, CLAUDE.md, layer files | S-AB1001-25 |
| AC-SETUP-05 agents, skills, commands, MCP, no secrets | S-AB1001-24 |
| AC-SETUP-06 Husky and commitlint block bad commits | S-AB1001-17 to S-AB1001-23 |
| AC-SETUP-07 build, lint, test run from the root | S-AB1001-13, S-AB1001-14, S-AB1001-15 |
| FR-X-3 input is validated | S-AB1001-06 |
| FR-X-4 secrets are never logged | S-AB1001-08 |
| FR-X-5 one error response shape | S-AB1001-02 to S-AB1001-05, S-AB1001-07 |
| SDS SA-29 liveness endpoint | S-AB1001-01 |
| Rule 11 types and schemas live in `packages/shared` | S-AB1001-16 |
| SDS 10.3 one test per scenario | S-AB1001-26 to S-AB1001-28 |
| SDS 11.6 and SA-40 the CI workflow is pinned, read-only and skips main | S-AB1001-29, S-AB1001-30 |
| SDS 9.1 and SA-35 lazy routes show a loading fallback | S-AB1001-31 |

FR-X-1, FR-X-2 and FR-X-6 apply to features with protected data (AB-1002 onward) and are not part of this change.

## Out of scope

- Any feature endpoint, schema or table. AB-1001 adds no Prisma models.
- The end-to-end user journey (AB-1016). Batch 6 only adds the Playwright harness.
- Authorization-denied scenarios: AB-1001 has no protected endpoint, so the guide's authorization-denied scenario does not apply here. The validation-failure scenario is S-AB1001-06.

## Impact

- New capabilities: `api-foundation`, `project-tooling` and `frontend-shell`.
- API: `GET /api/v1/health` (see `delta-openapi.yaml`). No other endpoint.
- No data migration. The Prisma schema has a generator and a datasource only.

## Rollback

Everything is new and nothing depends on it yet, so rolling back means reverting the AB-1001 commits. After AB-1002 starts, the foundations are shared and are changed only through a new ticket.
