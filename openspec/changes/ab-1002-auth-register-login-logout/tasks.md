# Tasks: AB-1002 auth (register, login, refresh, logout)

Spec and plan approved 2026-10-28. Estimates are minutes. `(subagent)` marks a task over 45 minutes (Rule 6). `[PARALLEL]` marks tasks on disjoint files that may run in separate worktrees (Rule 7); this ticket has no frontend, so the only disjoint pair is phase 1 (shared) and phase 2 (backend config and dependencies). Within a phase, each test task comes before the code it proves (red first), so tests that need later code in the phase stay red until it lands; the checkpoint at the end of the phase must be green. Every checkpoint is `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`, and never continues past a failure (Rule 12).

## 0. Prerequisite: SDS and FRS update (blocks `/implement`)

- [x] 0.1 `docs/SDS.md`: add nullable `rotatedAt timestamptz(3)` to the `RefreshToken` model in 6.2; change "revoked or rotated" to "rotated" in 4.3 (`INVALID_REFRESH_TOKEN`), 5.2 (Reuse), the 7.1 row #4 and SA-07; add a line to 5.2 that logout and family revocation set only `revokedAt` (20)
- [x] 0.2 `docs/FRS.md`: AC-AUTH-12 "already revoked or rotated" becomes "already rotated"; keep AC-AUTH-08 as is (10)
- [x] 0.3 Search `docs/` and `docs/api/openapi.yaml` for any other "revoked or rotated" wording and fix it; ADR-0003 is already updated (10)
- [x] 0.4 Checkpoint: `pnpm spec:validate`, then `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test` (5)

## 1. Shared contracts [PARALLEL]

- [x] 1.1 `packages/shared/src/constants/limits.ts`: `EMAIL_MAX`, `PASSWORD_MIN`, `PASSWORD_MAX`, `DISPLAY_NAME_MAX`, `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS` (10)
- [x] 1.2 `packages/shared/src/schemas/auth.test.ts`: one accepted and one rejected case per rule: trim and lower-case email, email max 254, password 8 to 128 with a letter and a digit, `displayName` trimmed 1 to 100, login password non-empty max 128, `AuthResponseSchema` strips unknown keys and requires `expiresIn` 900 (20)
- [x] 1.3 `packages/shared/src/schemas/auth.ts`: `PublicUserSchema`, `RegisterRequestSchema`, `LoginRequestSchema`, `AuthResponseSchema`, verified against Zod 4 with Context7 (25)
- [x] 1.4 `packages/shared/src/types.ts` and `src/index.ts`: export the four inferred types and the new modules (5)
- [x] 1.5 Checkpoint (`pnpm build` rebuilds `dist` for the backend) (5)

## 2. Backend dependencies and environment [PARALLEL]

- [x] 2.1 `backend/package.json` and `pnpm-lock.yaml`: add `jose` 6.2.13, `@node-rs/argon2` 2.2.2, `cookie-parser` 1.4.7 and dev `@types/cookie-parser` 1.4.10 with `pnpm add -E`, never `@latest`; confirm no install script needs the `onlyBuiltDependencies` list (15)
- [x] 2.2 Test `S-AB1002-32: a short JWT secret fails startup` in `backend/src/config/env.test.ts` (10)
- [x] 2.3 Test `S-AB1002-10: production rejects Argon2 parameters below the minimum` in `backend/src/config/env.test.ts` (15)
- [x] 2.4 `backend/src/config/env.ts`: add `JWT_ACCESS_SECRET`, `APP_ORIGIN`, `COOKIE_SECURE`, `ARGON2_MEMORY_KIB`, `ARGON2_TIME_COST` with the production minimums; update the existing cases in `env.test.ts` that now need the two required variables (25)
- [x] 2.5 `e2e/support/env.ts` and `e2e/playwright.config.ts`: test-only `JWT_ACCESS_SECRET` (at least 32 bytes), `APP_ORIGIN` and cheap Argon2 values for the backend web server (10)
- [x] 2.6 Checkpoint (5)

## 3. Database and test infrastructure

- [x] 3.1 `backend/prisma/schema.prisma`: `User` and `RefreshToken` from SDS 6.2 including `rotatedAt`, without the relations of later tickets (15)
- [x] 3.2 `backend/prisma/migrations/<timestamp>_auth_user_refresh_token/migration.sql`: after `pnpm db:up`, run `prisma migrate dev --create-only --name auth_user_refresh_token`, read the SQL against the design checklist (unique `email` and `tokenHash`, `CHAR(64)`, indexes on `userId` and `expiresAt`, `ON DELETE CASCADE`, `timestamptz(3)`), then apply and `prisma generate`; ask [y/n] before running the CLI (25)
- [x] 3.3 `backend/tests/setup/global-setup.ts` and `backend/vitest.config.ts`: run `prisma migrate deploy` once against `TEST_DATABASE_URL`, fail with a message that names `pnpm db:up` (20)
- [x] 3.4 `backend/tests/support/db.ts`: `useTestDatabase()` returns a Prisma client, truncates every table except `_prisma_migrations` before each test, disconnects after all (20)
- [x] 3.5 `backend/tests/support/test-app.ts`: new env values (cheap Argon2), `createMutableClock`, `registerUser` and refresh-cookie helpers, optional `passwordHasher` override (25)
- [x] 3.6 Checkpoint: existing AB-1001 tests stay green on the real migration (5)

## 4. Security helpers

- [x] 4.1 `backend/src/common/security/tokens.test.ts`: access token claims and `exp - iat` 900, `alg: none`, HS512, wrong secret, wrong audience and wrong issuer rejected, expiry by fake clock, refresh token is 43 base64url characters and its hash is 64 hex characters (20)
- [x] 4.2 `backend/src/common/security/tokens.ts`: `signAccessToken`, `verifyAccessToken`, `generateRefreshToken`, `hashRefreshToken` (25)
- [x] 4.3 `backend/src/common/security/hash.test.ts`: hash starts with `$argon2id$`, verify true and false, the dummy hash uses the configured parameters (15)
- [x] 4.4 `backend/src/common/security/hash.ts`: `createPasswordHasher` with a lazily computed dummy hash and no `algorithm` option (20)
- [x] 4.5 Checkpoint (5)

## 5. HTTP middleware

- [x] 5.1 Test `S-AB1002-29: a protected route without a token returns 401 UNAUTHORIZED` in `backend/src/common/http/require-auth.test.ts` with a test-local Express app and the real error handler (15)
- [x] 5.2 Test `S-AB1002-30: expired, wrongly signed and wrong-claim tokens return 401 UNAUTHORIZED` in the same file (20)
- [x] 5.3 `backend/src/common/http/origin-check.test.ts`: absent, equal, foreign and `null` origins, trailing-slash `APP_ORIGIN` (15)
- [x] 5.4 `backend/src/common/http/require-auth.ts`: `createRequireAuth({ secret, clock })` (20)
- [x] 5.5 `backend/src/common/http/origin-check.ts`: `createOriginCheck(appOrigin)` (10)
- [x] 5.6 `backend/src/common/http/validate.ts` and `validate.test.ts`: typed `validBody<T>(res)` accessor (10)
- [x] 5.7 Checkpoint (5)

## 6. Register and login

Tests first, in `backend/tests/integration/auth/register.test.ts` and `login.test.ts` (Supertest, real database):

- [x] 6.1 Test `S-AB1002-01: register creates the user and logs them in` (15)
- [x] 6.2 Test `S-AB1002-02: register without a display name returns null` (10)
- [x] 6.3 Test `S-AB1002-04: email is trimmed and stored in lower case` (10)
- [x] 6.4 Test `S-AB1002-05: duplicate email in any letter case returns 409 EMAIL_TAKEN` (10)
- [x] 6.5 Test `S-AB1002-06: register with an invalid email returns 400 VALIDATION_ERROR` (10)
- [x] 6.6 Test `S-AB1002-07: register with a weak password returns 400 VALIDATION_ERROR` (15)
- [x] 6.7 Test `S-AB1002-08: register with missing fields returns 400 VALIDATION_ERROR` (10)
- [x] 6.8 Test `S-AB1002-09: password is stored as an Argon2id hash` (10)
- [x] 6.9 Test `S-AB1002-12: login with correct credentials returns tokens` (15)
- [x] 6.10 Test `S-AB1002-13: refresh token is stored hashed with a 7-day expiry` (15)
- [x] 6.11 Test `S-AB1002-14: refresh cookie has the required attributes` (15)
- [x] 6.12 Test `S-AB1002-15: login with missing fields returns 400 VALIDATION_ERROR` (10)
- [x] 6.13 Test `S-AB1002-16: wrong password returns 401 INVALID_CREDENTIALS` (10)
- [x] 6.14 Test `S-AB1002-17: unknown email returns the same error as a wrong password`, with a spy `passwordHasher` (20)

Then the code:

- [x] 6.15 `backend/src/modules/auth/refresh-cookie.ts`: name, option builder, set helper, clear helper with `maxAge: 0` (15)
- [x] 6.16 `backend/src/modules/auth/auth.repository.ts`: `findUserByEmail`, `createUser` (null on `P2002`), `createRefreshToken`, `transaction(fn)` (40)
- [x] 6.17 `backend/src/modules/auth/auth.service.ts`: `register` and `login` with the dummy verify (40)
- [x] 6.18 `backend/src/modules/auth/auth.controller.ts` and `auth.routes.ts`: `POST /register` and `POST /login`, `cookie-parser` on the router, response parsed with `AuthResponseSchema` (30)
- [x] 6.19 `backend/src/app.ts`: build and mount the auth module, optional `passwordHasher` dependency (15)
- [x] 6.20 Checkpoint (5)

## 7. Refresh, logout and origin check

Tests first, in `refresh.test.ts`, `logout.test.ts` and `origin-check.test.ts` under `backend/tests/integration/auth/`:

- [x] 7.1 Test `S-AB1002-18: refresh rotates the refresh token` (15)
- [x] 7.2 Test `S-AB1002-19: an unknown token returns 401 and revokes nothing` (15)
- [x] 7.3 Test `S-AB1002-20: an expired token returns 401 and revokes nothing`, with the mutable clock (15)
- [x] 7.4 Test `S-AB1002-21: two concurrent refreshes with one token let exactly one win`, also asserting the user's tokens are all revoked afterwards (SDS 10.5) (25)
- [x] 7.5 Test `S-AB1002-22: reuse of a rotated token revokes all of the user's tokens` (20)
- [x] 7.6 Test `S-AB1002-23: a logged-out token returns 401 and revokes nothing else` (15)
- [x] 7.7 Test `S-AB1002-24: logout revokes the token and keeps other devices signed in` (15)
- [x] 7.8 Test `S-AB1002-25: logout with an unknown, revoked or missing cookie is a no-op success` (15)
- [x] 7.9 Test `S-AB1002-26: refresh from a foreign origin returns 403 FORBIDDEN_ORIGIN` (10)
- [x] 7.10 Test `S-AB1002-27: logout from a foreign origin returns 403 FORBIDDEN_ORIGIN` (10)
- [x] 7.11 Test `S-AB1002-28: matching or absent Origin is allowed` (10)

Then the code:

- [x] 7.12 `backend/src/modules/auth/auth.repository.ts`: `findRefreshTokenByHash`, `rotateRefreshToken` (compare-and-set), `revokeActiveToken`, `revokeAllActiveForUser` (35)
- [x] 7.13 (subagent) `backend/src/modules/auth/auth.service.ts` and `auth.service.test.ts`: `refresh` with the outcome-returning transaction (`rotated`, `invalid`, `reuse`), the compare-and-set loser re-read, and the throw after commit; verify `$transaction` against the installed Prisma 7.10.1 client (60)
- [x] 7.14 `backend/src/modules/auth/auth.service.ts`: `logout` that never throws for token state (15)
- [x] 7.15 `backend/src/modules/auth/auth.controller.ts` and `auth.routes.ts`: `POST /refresh` and `POST /logout` with `originCheck` first and the router-level error handler that clears the cookie on `INVALID_REFRESH_TOKEN` (40)
- [x] 7.16 Checkpoint (5)

## 8. Cross-cutting scenarios

- [x] 8.1 Test `S-AB1002-03: responses never contain a password or hash` in `backend/tests/integration/auth/responses.test.ts` (register, login and refresh bodies) (20)
- [x] 8.2 Test `S-AB1002-11: passwords and tokens are not logged` in `backend/tests/integration/auth/logging.test.ts` (25)
- [x] 8.3 Test `S-AB1002-31: a valid access token reaches the handler with the user ID` in `backend/tests/integration/auth/require-auth.test.ts` (log in on `createApp`, call a test-local guarded app built with the same secret and clock) (20)
- [x] 8.4 `backend/src/common/logger.ts`: only if 8.2 shows a leak, extend `REDACT_PATHS` (15). Not needed: 8.2 passed with the existing paths
- [x] 8.5 Checkpoint (5)

## 9. Definition of done

- [x] 9.1 `pnpm test --coverage`: at least 80% on every new or changed file of `shared` and `backend`, listed in the PR (15)
- [x] 9.2 `pnpm check:scenarios`: all 32 `S-AB1002-nn` IDs have exactly one test and no test uses an unknown ID (5)
- [x] 9.3 `pnpm spec:validate` and `pnpm exec openspec validate ab-1002-auth-register-login-logout --strict` (5)
- [x] 9.4 Compare `delta-openapi.yaml` with the implemented statuses, codes and cookie attributes, and fix whichever side is wrong (15)
- [x] 9.5 Manual smoke test against `pnpm dev` and the dev database, without reading any `.env` file: register, login, refresh (twice, the second with the old cookie), logout, then each error scenario (409, 400 variants, 401 wrong credentials, 401 unknown refresh, 403 foreign origin, 401 without token on a guarded route) (40). Run by the user with a script against `src/server.ts` on the dev database (65 of 65 checks passed). No guarded route exists yet, so that item is covered only by S-29 to S-31
- [x] 9.6 Confirm no password, token or hash appears in the server log from 9.5 (5)
- [x] 9.7 Checkpoint: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test` (5)
- [ ] 9.8 Reminder: run `/sdd-review AB-1002` in a fresh terminal (new Claude instance, read-only `reviewer` agent). Run `/pr AB-1002` only when it shows all ✅ (0)

## Coverage: requirement to tasks

| Spec requirement | Scenarios | Tasks |
| --- | --- | --- |
| Registration (AC-AUTH-01, 04, 11) | 01, 02, 03 | 1.3, 6.1, 6.2, 6.15 to 6.19, 8.1 |
| Email is valid, unique and normalised | 04, 05, 06 | 1.2, 1.3, 6.3, 6.4, 6.5, 6.16, 6.17 |
| Password rules | 06, 07, 08 | 1.2, 1.3, 6.5, 6.6, 6.7 |
| Password storage | 09, 10, 11 | 2.3, 2.4, 4.3, 4.4, 6.8, 8.2, 8.4 |
| Login | 12, 13, 14, 15 | 4.1, 4.2, 6.9 to 6.12, 6.15 to 6.19 |
| Login errors do not reveal an account | 16, 17 | 6.13, 6.14, 6.17 |
| Refresh rotates the token | 18, 19, 20, 21 | 7.1 to 7.4, 7.12, 7.13, 7.15 |
| Reuse of a rotated token revokes every session | 22, 23 | 0.1 to 0.3, 3.1, 3.2, 7.5, 7.6, 7.12, 7.13 |
| Logout revokes only the presented token | 24, 25 | 7.7, 7.8, 7.14, 7.15 |
| Origin check on cookie endpoints | 26, 27, 28 | 5.3, 5.5, 7.9 to 7.11, 7.15 |
| Access token guards protected routes | 29, 30, 31 | 4.1, 4.2, 5.1, 5.2, 5.4, 8.3 |
| Access token secret length | 32 | 2.2, 2.4 |

## Coverage: scenario to test task

| Scenario | Test task | Scenario | Test task | Scenario | Test task |
| --- | --- | --- | --- | --- | --- |
| S-AB1002-01 | 6.1 | S-AB1002-12 | 6.9 | S-AB1002-23 | 7.6 |
| S-AB1002-02 | 6.2 | S-AB1002-13 | 6.10 | S-AB1002-24 | 7.7 |
| S-AB1002-03 | 8.1 | S-AB1002-14 | 6.11 | S-AB1002-25 | 7.8 |
| S-AB1002-04 | 6.3 | S-AB1002-15 | 6.12 | S-AB1002-26 | 7.9 |
| S-AB1002-05 | 6.4 | S-AB1002-16 | 6.13 | S-AB1002-27 | 7.10 |
| S-AB1002-06 | 6.5 | S-AB1002-17 | 6.14 | S-AB1002-28 | 7.11 |
| S-AB1002-07 | 6.6 | S-AB1002-18 | 7.1 | S-AB1002-29 | 5.1 |
| S-AB1002-08 | 6.7 | S-AB1002-19 | 7.2 | S-AB1002-30 | 5.2 |
| S-AB1002-09 | 6.8 | S-AB1002-20 | 7.3 | S-AB1002-31 | 8.3 |
| S-AB1002-10 | 2.3 | S-AB1002-21 | 7.4 | S-AB1002-32 | 2.2 |
| S-AB1002-11 | 8.2 | S-AB1002-22 | 7.5 | | |

All 12 requirements and all 32 scenarios map to at least one task, and each scenario has exactly one test task. There are no gaps.
