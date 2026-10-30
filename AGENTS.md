# AGENTS.md

Universal context for every AI tool. Business truth: `docs/FRS.md`. Technical truth: `docs/SDS.md` (binding). Decisions: `docs/decisions/ADR-*.md`. Assignment rules: `docs/reference/ASSIGNMENT.md`. If two documents disagree, the assignment wins, then the FRS, then the SDS.

## Project

Full-stack Note Taking App built as a Spec-Driven Development exercise. Users register, create rich-text notes, tag and search them, share public read-only links, and restore old versions. 16 tickets, `AB-1001` to `AB-1016`, built strictly in order, one ticket per session.

Out of scope (a violation if built): real-time collaboration, attachments, mobile app, OAuth, folders/nesting, real email (OTP is logged to the console only), login throttling.

## Repository layout

```text
backend/          Express 5 API: routes -> controller -> service -> repository
frontend/         React 19 SPA, organised by features/
packages/shared/  Zod schemas, inferred types, limits. The only place types live
e2e/              Playwright tests
docs/             FRS.md, SDS.md, decisions/, api/openapi.yaml, reference/
openspec/         config.yaml, specs/ (current behaviour), changes/ (active), archive
.claude/          settings, agents, commands, skills, hooks
```

## Tech stack (fixed, exact versions pinned in `docs/SDS.md` section 3)

React 19, TypeScript 6, Vite, TanStack Query, Zustand, TipTap, shadcn/ui, react-router 7. Node 22, Express 5. PostgreSQL 16, Prisma 7 (driver adapter `@prisma/adapter-pg`). Zod 4. JWT via `jose`, Argon2id via `@node-rs/argon2`. Vitest, Supertest, Playwright. pnpm 10 workspaces.

Never use `@latest`. Every version is exact (`savePrefix: ''`). Verify any library API with Context7 before using it.

## Commands (root)

| Task | Command |
| --- | --- |
| Install | `pnpm install` |
| Build | `pnpm build` (shared first, then backend and frontend) |
| Lint | `pnpm lint --max-warnings 0` |
| Types | `pnpm typecheck` |
| Test | `pnpm test --coverage` (80% per package) |
| E2E | `pnpm test:e2e` |
| Databases | `pnpm db:up` / `pnpm db:down` (docker compose, postgres 16) |
| Spec check | `pnpm spec:validate`, `pnpm check:scenarios` |
| OpenSpec CLI | `pnpm exec openspec ...` (pinned, never global) |

These scripts exist after AB-1001 scaffolding is complete.

## Architecture rules

1. **Contract first.** Every request and response is a Zod schema in `packages/shared`. Backend validates input and parses output with it. Frontend parses responses with it. Never redefine a type elsewhere. Outside shared, `zod` is a type-only import (lint enforces it); the one exception is the backend `Env` schema in `src/config/env.ts`, which is runtime config, not an API contract.
2. **Layers.** routes (validate, auth) -> controller (HTTP only) -> service (business rules, transactions) -> repository (only place that touches Prisma). No Prisma outside repositories.
3. **Ownership in the query.** Every repository method takes `userId` in its `WHERE`. Another user's or a missing resource is `404`, never `403`.
4. **Dependency injection.** `createApp({ prisma, clock, emailService, env })`. Modules never import `env` or the Prisma singleton. Time comes from the injected `Clock`.
5. **One transaction per invariant:** note save + version snapshot, tag replacement, OTP reset, restore.
6. **Express 5.** `req.query` is read-only: put validated data in `res.locals`. Rejected promises reach the error middleware, so no try/catch wrappers.
7. **Raw SQL** only as Prisma tagged templates. `$queryRawUnsafe` is banned. Repeat `"deletedAt" IS NULL` in every raw query on notes.

## Auth

- Access token: JWT HS256, 15 min, in browser memory only. Refresh token: opaque 256-bit, 7 days, stored as SHA-256 hash, rotated on every use, delivered only as an `HttpOnly` cookie `refresh_token` (`SameSite=Strict`, `Path=/api/v1/auth`, `Secure` in production).
- Reuse of a rotated refresh token returns 401 and revokes all of that user's refresh tokens (AC-AUTH-12).
- Passwords: Argon2id. OTP: 6 digits, 10 min, single use, 5 attempts, stored as HMAC-SHA256. OTP is logged to the console. Only when `NODE_ENV=test` it is also appended to `e2e/.output/otp.jsonl` (ADR-0004). That mechanism must never run elsewhere.

## API conventions

- Base path `/api/v1`. 28 endpoints, listed with schemas and codes in SDS section 7. Those status and error codes are binding.
- Error body: `{ "error": { "code", "message", "details?", "requestId" } }`.
- Used statuses: 200, 201, 204, 400, 401, 403 (origin check only), 404, 409, 413, 500. Never 403 for ownership, never 422, 429 or 410.
- Pagination `?page&pageSize` (default 1 and 20, max 100); response `{ items, page, pageSize, total, totalPages }`. Soft-deleted notes never appear in lists, search, shares or versions.

## Database (SDS section 6)

Models: User, RefreshToken, PasswordResetOtp, Note, Tag, NoteTag, ShareLink, NoteVersion. UUIDv7 ids. Children use `onDelete: Cascade`. Soft delete = `Note.deletedAt` only. Restorable while `deletedAt > now - 30 days`; the purge job deletes only when `deletedAt <= now - 30 days` (Rule 15). Search: generated `tsvector` column + GIN index, created in a hand-edited migration (`prisma migrate dev --create-only`).

## Feature designs worth knowing

- **Search:** `plainto_tsquery('english')`. Highlight: random-nonce markers, then HTML-escape, then `<mark>`. The frontend renders text nodes, never `innerHTML`.
- **Sharing:** 256-bit base64url token, many links per note. Public view is one `UPDATE ... RETURNING` (atomic count). Unknown, revoked, expired and deleted-note links are all `404 SHARE_LINK_NOT_FOUND`.
- **Versions:** full snapshots, `Note.lastVersionNumber` counter, row lock, identical save is a no-op, keep newest 50, restore = new version.

## Frontend conventions

TanStack Query holds server data. Zustand holds only the session and the editor save state. Access token lives in memory. `apiFetch` refreshes once on 401 (single flight + Web Locks). TipTap autosave: 2 s debounce, one request at a time. Editor allow-list equals the Zod `TipTapDocSchema`. shadcn components in `components/ui/` are generated, not hand-edited.

## Testing

- Unit (Vitest), integration (Vitest + Supertest against real Postgres `noteapp_test`, port 5433), component (Testing Library + msw), E2E (Playwright, `noteapp_e2e`).
- One named test per spec scenario: title starts with `S-AB<ticket>-<nn>`. `scripts/check-scenarios.mjs` enforces it.
- No test sleeps; inject a fake `Clock`. Coverage threshold 80%.

## Coding standards

- TypeScript `strict`; no `any`, no `@ts-ignore`, no `eslint-disable` without a ticket ID.
- Backend and shared are ESM with NodeNext: relative imports end in `.js`. Frontend uses Bundler resolution and the `@/*` alias (no `baseUrl`).
- Match surrounding code: naming, comment density, idiom. Comment only the non-obvious why.

## Anti-patterns

- Types or schemas declared in `backend/` or `frontend/` instead of `packages/shared`.
- Prisma calls in services or controllers; queries without `userId`.
- Physically deleting a note inside the 30-day window.
- Reading or logging secrets, tokens, OTPs (except the console OTP and the test-only file), or `.env` files.
- Inventing a library method without checking Context7.
- Starting work on a ticket without an approved spec.
