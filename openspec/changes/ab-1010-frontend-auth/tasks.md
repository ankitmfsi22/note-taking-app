# Tasks: AB-1010 frontend auth

Estimates in minutes. Test first in each phase. Every checkpoint: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test --coverage` (≥ 80%), `pnpm check:scenarios`; never continue past a failure. Frontend only, so nothing is `[PARALLEL]` with backend work in this repo copy.

## 1. Dependencies and UI pieces

- [x] 1.1 `pnpm add -E --filter frontend react-hook-form@7.91.0 @hookform/resolvers@6.0.2 zustand@5.0.16` (5)
- [x] 1.2 shadcn `input`, `label`, `card` with CLI 4.23.0 (`--dry-run --view`, then Write) (10)
- [x] 1.3 Checkpoint; S-AB1001-31 gets a 5 s wait for the cold first lazy import (it failed 2 of 3 runs on Windows) (5)

## 2. Session store and apiFetch

- [x] 2.1 Test S-AB1010-05 in `lib/api-client.test.ts` (Bearer, single flight, retry once, failure clears session, no refresh for `auth: false`) (25)
- [x] 2.2 `features/auth/session-store.ts` and the `apiFetch` changes, plus `apiSend` for 204 responses (shared has no empty-body schema) (30)
- [x] 2.3 `features/auth/api.ts` and `queries.ts` (15)
- [x] 2.4 Checkpoint (5)

## 3. Forms and pages

- [x] 3.1 Tests S-AB1010-01, S-AB1010-03 (forms) and S-AB1010-02 (pages) (30)
- [x] 3.2 Login and register forms, server error mapping, pages (35)
- [x] 3.3 Checkpoint (5)

## 4. Routing, guards, logout

- [x] 4.1 Tests S-AB1010-04, S-AB1010-06; update the S-AB1001-31 test and the route-table test (25)
- [x] 4.2 `guards.ts`, `auth-layout.tsx`, `app-shell.tsx`, `notes-placeholder.tsx`, router changes, remove `home.tsx` (30)
- [x] 4.3 Checkpoint, plus `pnpm spec:validate`; frontend `testTimeout` 20 s and Testing Library `asyncUtilTimeout` 5 s, because typing tests and cold lazy imports timed out under coverage on Windows (5)

## 5. Forgot and reset password (after AB-1003 is merged)

- [ ] 5.1 Add S-AB1010-07 and S-AB1010-08 to the spec and get approval (10)
- [ ] 5.2 Tests, then `/forgot-password` and `/reset-password` pages (45)
- [ ] 5.3 Checkpoint (5)
