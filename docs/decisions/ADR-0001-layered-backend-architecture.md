# ADR-0001: Layered backend architecture (routes, controller, service, repository)

- Status: Accepted (accepted with `docs/SDS.md` on 2026-10-28)
- Date: 2026-10-28
- Tickets: AB-1001 onwards (every backend ticket)
- SDS: Sections 1, 2.1

## Context

The backend must enforce ownership on every query (FR-X-1), keep business rules testable without a database, and keep soft-delete filtering impossible to forget (Rule 15). AI-written code tends to put logic wherever it is convenient, so the structure has to make the right place obvious and the wrong place lint-able.

## Decision

Each backend module has four files with one job each:

| Layer | Knows about | Must not |
| --- | --- | --- |
| `routes` | URL, HTTP method, which shared Zod schemas validate input, which middleware runs | contain logic |
| `controller` | `req` and `res`, `res.locals`, status codes, DTO parsing | call Prisma, hold business rules |
| `service` | business rules, transactions, `AppError`, the injected `Clock` and `EmailService` | import Express, import Prisma directly (it calls a repository) |
| `repository` | Prisma and tagged-template raw SQL | hold business rules; take a query without `userId` |

- `createApp(deps)` receives `{ prisma, clock, emailService, env }`. Modules never import the Prisma singleton or `env` themselves, so tests inject fakes.
- Repository methods have names that encode scope (`findActiveByIdForUser`, `listTrashedForUser`). There is no plain `findById`.
- ESLint `no-restricted-imports` forbids importing the generated Prisma client outside `*.repository.ts`, `common/db/` and `testing/`.
- Express 5 forwards rejected async handlers to the error middleware, so controllers are plain `async` functions.

## Consequences

- Services unit-test with fake repositories; repositories are covered by integration tests against PostgreSQL.
- A new feature touches four small files, which keeps tasks small (guide: 1 to 2 hours each).
- More files per module than a single-file router. Accepted for the ownership and testability gain.

## Alternatives considered

- **Fat controllers calling Prisma:** rejected. Ownership and soft-delete filters would be repeated and easy to miss.
- **Prisma Client extension that auto-adds `deletedAt: null`:** rejected. It hides the rule, and raw SQL (search, shares) bypasses it anyway.
- **Hexagonal ports and adapters with a DI container:** rejected as heavier than the problem needs; plain constructor injection is enough.
