## Why

Every feature after AB-1001 needs to know who the user is and to keep each user's data private (FR-X-1). AB-1002 adds the accounts and the session mechanism: register, login, a short-lived access token, a rotating refresh token and logout (US-AUTH-1 to 4). AB-1003 (password reset), AB-1004 (notes) and AB-1010 (frontend auth) build on it.

## What Changes

- Adds the `User` and `RefreshToken` tables in one Prisma migration (SDS 6.2, 6.4).
- Adds four endpoints: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` (SDS 7, rows 2 to 5).
- Adds the shared schemas `PublicUserSchema`, `RegisterRequestSchema`, `LoginRequestSchema` and `AuthResponseSchema` in `packages/shared`.
- Adds access tokens (`jose`, HS256, 15 minutes), opaque refresh tokens (SHA-256 at rest, rotation, reuse detection with revocation of all the user's tokens) and Argon2id password hashing (`@node-rs/argon2`).
- Adds the `requireAuth` middleware and the `origin-check` middleware, and the auth module (routes, controller, service, repository) following the layers of `AGENTS.md`.
- Adds the environment variables `JWT_ACCESS_SECRET`, `APP_ORIGIN`, `COOKIE_SECURE`, `ARGON2_MEMORY_KIB` and `ARGON2_TIME_COST` to the backend `Env` schema, with the production minimums (SDS 11, section 5.4).
- Wires the auth module into `createApp({ prisma, clock, env, ... })`. Time comes from the injected `Clock`.

## FRS coverage

| FRS requirement | Scenarios |
| --- | --- |
| AC-AUTH-01 register input | S-AB1002-01, S-AB1002-02 |
| AC-AUTH-02 email valid, unique, lower case | S-AB1002-04, S-AB1002-05, S-AB1002-06 |
| AC-AUTH-03 password rule | S-AB1002-07 |
| AC-AUTH-04 registration logs in | S-AB1002-01 |
| AC-AUTH-05 15-minute access token, 7-day refresh token | S-AB1002-12, S-AB1002-13, S-AB1002-14 |
| AC-AUTH-06 refresh token stored server-side | S-AB1002-13 |
| AC-AUTH-07 rotation | S-AB1002-18, S-AB1002-21 |
| AC-AUTH-08 used, revoked or expired token rejected | S-AB1002-19, S-AB1002-20, S-AB1002-22 |
| AC-AUTH-09 logout revokes the presented token only | S-AB1002-24 |
| AC-AUTH-10 one error for wrong email and wrong password | S-AB1002-16, S-AB1002-17 |
| AC-AUTH-11 no password or hash in a response | S-AB1002-03, S-AB1002-09 |
| AC-AUTH-12 reuse revokes all of the user's tokens | S-AB1002-22, S-AB1002-23 |
| ERR-AUTH-01 duplicate email | S-AB1002-05 |
| ERR-AUTH-02 invalid email or weak password | S-AB1002-06, S-AB1002-07 |
| ERR-AUTH-03 missing fields | S-AB1002-08, S-AB1002-15 |
| ERR-AUTH-04 wrong credentials | S-AB1002-16, S-AB1002-17 |
| ERR-AUTH-05 refresh rejected | S-AB1002-19 to S-AB1002-23 |
| ERR-AUTH-06 logout is idempotent | S-AB1002-25 |
| ERR-AUTH-07 bad access token | S-AB1002-29, S-AB1002-30, S-AB1002-31 |
| FR-X-4 secrets never stored or logged in plain text | S-AB1002-09, S-AB1002-11, S-AB1002-13 |
| SDS 5.3 cookie attributes | S-AB1002-14 |
| SDS 5.3 and SA-05 origin check | S-AB1002-26, S-AB1002-27, S-AB1002-28 |
| SDS 5.4 Argon2 minimums, 5.1 secret length (environment) | S-AB1002-10, S-AB1002-32 |

Authorization-denied scenario: S-AB1002-29 (no token gives `401 UNAUTHORIZED`). Validation-failure scenarios: S-AB1002-06, S-AB1002-07, S-AB1002-08, S-AB1002-15.

## Assumptions to confirm

- **[ASSUMPTION — confirm]** AB-1002 has no protected endpoint, so the `requireAuth` scenarios (S-AB1002-29 to S-AB1002-31) run against a route registered only in the test app. The first real protected endpoint arrives with AB-1004.
- **[ASSUMPTION — confirm]** A refresh request with no cookie is treated like an unknown token: `401 INVALID_REFRESH_TOKEN`, cookie cleared, nothing revoked (SDS 4.3 lists "missing" under that code).
- **Decided in review (2026-10-28):** only reuse of a rotated (replaced) refresh token triggers family revocation. A token revoked by logout returns `401 INVALID_REFRESH_TOKEN` and revokes nothing else (S-AB1002-23). This narrows AC-AUTH-12 and SDS 5.2, which say "revoked or rotated"; see the open item in the review notes.
- **[ASSUMPTION — confirm]** Omitted `displayName` is stored as `NULL` and returned as `null`.
- **[ASSUMPTION — confirm]** S-AB1002-17 proves the dummy verify by a spy on the Argon2 `verify` wrapper, not by timing, because timing tests are flaky.
- **[ASSUMPTION — confirm]** S-AB1002-21 (concurrent refresh) runs against the real test database with two parallel requests, because the compare-and-set can only be proven with a real transaction.

## Out of scope

- Forgot-password, OTP and password reset (AB-1003).
- The frontend: login and register pages, the in-memory token, `apiFetch` refresh, single flight and Web Locks (AB-1010).
- Login throttling or rate limiting, OAuth, real email, password change and account deletion (FRS section 13).
- The purge of expired refresh tokens (`HousekeepingJob`, SDS 8.5).
- Any note, tag, search or share endpoint.

## Impact

- New capability: `auth`.
- API: four endpoints under `/api/v1/auth` (see `delta-openapi.yaml`). Statuses and codes follow SDS section 7.1 and 4.3 and are binding.
- Database: one migration that creates `User` and `RefreshToken` (UUIDv7 IDs, `onDelete: Cascade`, `tokenHash` unique, indexes on `userId` and `expiresAt`).
- Dependencies, each pinned to an exact version with Context7 checked: `jose`, `@node-rs/argon2`.
- No change to a binding SDS code or endpoint, so no SDS update is needed.

## Rollback

The migration is additive and nothing else depends on it yet, so rolling back means reverting the AB-1002 commits and the migration (`User` and `RefreshToken` hold only test data before release). After AB-1003 or AB-1004 start, the tables are shared and are changed only through a new ticket.
