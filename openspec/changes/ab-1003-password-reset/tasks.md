# Tasks: AB-1003 password reset (forgot-password, OTP, reset)

Spec and plan approved 2026-10-29 and re-approved the same day after the S-AB1003-22 edit. Estimates are minutes. `(subagent)` marks a task over 45 minutes (Rule 6); no task here exceeds 45, so none is marked. `[PARALLEL]` marks tasks on disjoint files that may run in separate worktrees (Rule 7); this ticket has no frontend, so the only disjoint pair is phase 1 (shared) and phase 2 (backend config and e2e env). Phase 3 is not parallel: a migration must not run from two worktrees against one dev database (SDS 6.4). Within a phase, each test task comes before the code it proves (red first), so tests that need later code in the phase stay red until it lands; the checkpoint at the end of the phase must be green. Every checkpoint is `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`, and never continues past a failure (Rule 12).

No SDS or FRS change is needed (design.md, intro), so there is no prerequisite phase. Support tests (no scenario ID) are named without `S-AB1003`, so `pnpm check:scenarios` keeps exactly one test per scenario.

## 1. Shared contracts [PARALLEL]

- [x] 1.1 `packages/shared/src/constants/limits.ts`: add `OTP_LENGTH` 6, `OTP_TTL_MINUTES` 10, `OTP_MAX_ATTEMPTS` 5 (5)
- [x] 1.2 `packages/shared/src/schemas/auth.test.ts`: one accepted and one rejected case per rule of `ForgotPasswordRequestSchema` (email trimmed, lower-cased, valid, max 254) and `ResetPasswordRequestSchema` (email as above, `otp` exactly 6 digits, `newPassword` 8 to 128 with a letter and a digit); keep a case proving `RegisterRequestSchema` still rejects the same passwords after the refactor (20)
- [x] 1.3 `packages/shared/src/schemas/auth.ts`: extract the register password rule into an exported `NewPasswordSchema`, use it in `RegisterRequestSchema`, add `ForgotPasswordRequestSchema` and `ResetPasswordRequestSchema` (OTP pattern from `OTP_LENGTH`), verified against Zod 4 with Context7 (20)
- [x] 1.4 `packages/shared/src/types.ts` and `src/index.ts`: export `ForgotPasswordRequest` and `ResetPasswordRequest` (5)
- [x] 1.5 Checkpoint (`pnpm build` rebuilds `dist` for the backend) (5)

## 2. Environment and e2e variables [PARALLEL]

- [x] 2.1 Test `S-AB1003-21: the env schema rejects OTP_TEST_FILE outside the test environment` in `backend/src/config/env.test.ts` (development, production rejected, test accepted) (15)
- [x] 2.2 Test `S-AB1003-24: the env schema enforces the OTP_HMAC_SECRET rules` in `backend/src/config/env.test.ts` (missing, 31 bytes, equal to the JWT secret rejected, distinct 32 bytes accepted) (15)
- [x] 2.3 `backend/src/config/env.ts`: add `OTP_HMAC_SECRET` (at least 32 bytes, different from `JWT_ACCESS_SECRET`) and optional `OTP_TEST_FILE` (only when `NODE_ENV` is `test`); update `valid` and the "applies the defaults" case in `env.test.ts` (25)
- [x] 2.4 `e2e/support/env.ts` and `e2e/playwright.config.ts`: test-only `E2E_OTP_HMAC_SECRET` (at least 32 bytes, different from the JWT secret) passed as `OTP_HMAC_SECRET` to the backend web server; leave `OTP_TEST_FILE` unset (10)
- [x] 2.5 `backend/tests/support/test-app.ts`: add `OTP_HMAC_SECRET` to `createTestEnv` (5)
- [x] 2.6 Checkpoint (5)

## 3. Database

- [x] 3.1 `backend/prisma/schema.prisma`: `model PasswordResetOtp` exactly as SDS 6.2 and `passwordResetOtps PasswordResetOtp[]` on `User` (10)
- [x] 3.2 `backend/prisma/migrations/<timestamp>_auth_password_reset_otp/migration.sql`: after `pnpm db:up`, run `prisma migrate dev --create-only --name auth_password_reset_otp`, read the SQL against the design checklist (`otpHash CHAR(64)`, `attempts INTEGER NOT NULL DEFAULT 0`, `timestamptz(3)` columns, index on `userId` and `createdAt DESC`, foreign key `ON DELETE CASCADE`), then apply and `prisma generate`; ask [y/n] before running the CLI (25)
- [x] 3.3 Checkpoint: existing AB-1001 and AB-1002 tests stay green on the new migration (5)

## 4. Security helpers

- [x] 4.1 `backend/src/common/security/tokens.test.ts`: support test for `generateOtp`: always 6 digits, zero-padded for a forced value below 100000, never reaches 1000000 (10)
- [x] 4.2 `backend/src/common/security/tokens.ts`: `generateOtp(random = randomInt)`, verified against Node 22 with Context7 (5)
- [x] 4.3 `backend/src/common/security/hash.test.ts`: support tests for `createOtpHasher`: `hash` is 64 hex characters and depends on user and OTP, `matches` true and false, a stored hash of another length returns false, `verifyDummy` always false (15)
- [x] 4.4 `backend/src/common/security/hash.ts`: `createOtpHasher({ secret })` with `hash`, `matches` (`timingSafeEqual` on two `Buffer`s) and `verifyDummy` (20)
- [x] 4.5 Checkpoint (5)

## 5. Email module and test sink

- [x] 5.1 Test `S-AB1003-19: ConsoleEmailService logs the email and OTP to the console` in `backend/src/modules/email/email.service.test.ts` (injected `write` spy, no network call) (10)
- [x] 5.2 Test `S-AB1003-20: the test sink appends a JSON line per OTP when NODE_ENV is test` in the same file (temporary file, two calls, last line, ISO `issuedAt` from the fake clock, file mode `0600`) (15)
- [x] 5.3 Test `S-AB1003-23: the console log is unchanged while the sink is active` in the same file (10)
- [x] 5.4 Test `S-AB1003-22: building the email service outside test never imports the sink` in `backend/src/modules/email/build-email-service.test.ts` (spied loader never called for development and production, called once for test) (15)
- [x] 5.5 `backend/src/modules/email/email.service.ts`: `EmailService`, `OtpSink` and `OtpSinkModule` types, `ConsoleEmailService({ write, sink? })` (write first, then sink) (15)
- [x] 5.6 `backend/src/testing/otp-test-sink.ts`: `createOtpTestSink({ filePath?, clock })` with `mkdir` recursive and `appendFile` mode `0o600`, default path at the repository root `e2e/.output/otp.jsonl`; imports only types from the email module; verified against Node 22 with Context7 (15)
- [x] 5.7 `backend/src/modules/email/build-email-service.ts`: `buildEmailService({ env, write, clock, loadSink? })`, calling `loadSink` only when `env.NODE_ENV === 'test'` (15)
- [x] 5.8 `backend/src/server.ts`: make `start` async, build the email service with `write` on `process.stdout.write`, and declare `loadSink` only in the `NODE_ENV === 'test'` branch (15)
- [x] 5.9 Checkpoint (5)

## 6. Forgot-password

Tests first, in `backend/tests/integration/auth/forgot-password.test.ts` (Supertest, real database) unless noted:

- [ ] 6.1 `backend/tests/support/email.ts`: `createSpyEmailService()` that records `{ email, otp }`, offers `otpFor(email)`, and can be set to reject (10)
- [ ] 6.2 Test `S-AB1003-01: forgot-password for a known email returns 204 and sends the OTP` (10)
- [ ] 6.3 Test `S-AB1003-02: known and unknown email give an identical response` (15)
- [ ] 6.4 Test `S-AB1003-04: the OTP is stored only as an HMAC` (recompute the HMAC with the test secret, compare with a bare SHA-256) (15)
- [ ] 6.5 Test `S-AB1003-06: forgot-password with a malformed email returns 400 VALIDATION_ERROR` (10)
- [ ] 6.6 Test `S-AB1003-25: an email delivery failure does not change the forgot-password response` (rejecting spy, `createLogCapture` shows neither OTP nor email) (15)
- [ ] 6.7 Test `S-AB1003-03: the OTP is six digits and expires after ten minutes` in `backend/src/modules/auth/password-reset.service.test.ts` (fake repository, fake clock, injected `generateOtp` below 100000) (20)
- [ ] 6.8 `backend/src/modules/auth/auth.repository.ts`: `invalidateUnusedOtps`, `createOtp`, `findLatestOtp`, `claimOtpAttempt`, `findOtp`, `invalidateOtp`, `markOtpUsed`, `updatePasswordHash`, every method with `userId` in its `WHERE`; Prisma `updateMany` with atomic `increment` and `lt` checked with Context7 (30)
- [ ] 6.9 `backend/src/modules/auth/password-reset.service.ts`: `createPasswordResetService` with `requestOtp` (transaction, then `sendOtp` in a deliberate `try/catch` that logs the error name only) (25)
- [ ] 6.10 `backend/src/modules/auth/password-reset.controller.ts` (`forgotPassword`), the `POST /forgot-password` route, `app.ts` (`emailService` required, `otpHasher` optional) and the spy as the `createTestApp` default (25)
- [ ] 6.11 Checkpoint (5)

## 7. Reset password

Tests first, in `backend/tests/integration/auth/reset-password.test.ts` (Supertest, real database, `createMutableClock` where time matters):

- [ ] 7.1 Test `S-AB1003-05: a new OTP invalidates the earlier unused OTP` (10)
- [ ] 7.2 Test `S-AB1003-07: reset with a correct OTP changes the password and uses the OTP` (15)
- [ ] 7.3 Test `S-AB1003-08: reset revokes every refresh token and does not log in` (15)
- [ ] 7.4 Test `S-AB1003-09: the old password stops working after a reset` (10)
- [ ] 7.5 Test `S-AB1003-10: a used OTP is rejected` (10)
- [ ] 7.6 Test `S-AB1003-11: a wrong OTP is rejected and counted` (10)
- [ ] 7.7 Test `S-AB1003-12: an expired OTP is rejected` (clock advanced by exactly 10 minutes) (10)
- [ ] 7.8 Test `S-AB1003-13: a weak new password is rejected and the OTP stays usable` (four passwords, `attempts` stays 0, a valid retry returns 204) (15)
- [ ] 7.9 Test `S-AB1003-14: a reset for an unknown email returns the wrong-OTP error` (injected spy `otpHasher`, `verifyDummy` called once, same message as S-11) (15)
- [ ] 7.10 Test `S-AB1003-15: the fifth wrong attempt invalidates the OTP` (15)
- [ ] 7.11 Test `S-AB1003-16: after five failures a correct OTP is rejected until a new one is requested` (15)
- [ ] 7.12 Test `S-AB1003-17: an OTP that is not six digits returns 400 VALIDATION_ERROR` (10)
- [ ] 7.13 Test `S-AB1003-18: two concurrent resets with the same OTP succeed only once` (`Promise.all` on the real database) (20)
- [ ] 7.14 `backend/src/modules/auth/password-reset.service.ts`: `resetPassword` (unknown email dummy, claim before compare, outcome returned and thrown after the commit, Argon2 hash after the match, `markOtpUsed` compare-and-set, `updatePasswordHash`, `revokeAllActiveForUser`), one error factory for every rejection (40)
- [ ] 7.15 `password-reset.controller.ts` (`resetPassword`, `204` with no cookie) and the `POST /reset-password` route in `auth.routes.ts` (10)
- [ ] 7.16 Checkpoint (5)

## 8. Verification and hand-off

- [ ] 8.1 `pnpm test --coverage`: at least 80% on the new code (the email module, `password-reset.*`, the new repository methods, `hash.ts` and `tokens.ts` additions); add tests for any uncovered branch, never lower the threshold (20)
- [ ] 8.2 `pnpm check:scenarios`: no scenario without a test, no duplicate and no unknown ID for the 25 `S-AB1003` scenarios (5)
- [ ] 8.3 `pnpm spec:validate` (`openspec validate ab-1003-password-reset --strict`) (5)
- [ ] 8.4 Compare `delta-openapi.yaml` with the implemented statuses and codes (204 for both endpoints, `400 VALIDATION_ERROR`, `400 OTP_INVALID_OR_EXPIRED`, no `Set-Cookie`), and fix whichever side is wrong (15)
- [ ] 8.5 Manual smoke test against `pnpm dev` and the dev database, without reading any `.env` file, reading the OTP from the server console output: forgot-password for a known and an unknown email, reset with the correct OTP, login with the old and the new password, reset with a used OTP, then each error scenario (400 malformed email, 400 weak password, 400 wrong OTP, 400 expired OTP, 400 unknown email, 400 after five wrong attempts, 400 OTP with fewer than six digits) (40)
- [ ] 8.6 Confirm the OTP and the new password appear in the server log from 8.5 only as the single console line of AC-PWD-10, and that no `otp.jsonl` file exists after a run with `NODE_ENV=development` (5)
- [ ] 8.7 Checkpoint: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test` (5)
- [ ] 8.8 Reminder: run `/sdd-review AB-1003` in a fresh terminal (new Claude instance, read-only `reviewer` agent). Run `/pr AB-1003` only when it shows all ✅ (0)

## Coverage: requirement to tasks

| Spec requirement | Scenarios | Tasks |
| --- | --- | --- |
| Forgot-password request (AC-PWD-01, 02, ERR-PWD-01) | 01, 02, 06, 25 | 1.2, 1.3, 6.1 to 6.3, 6.5, 6.6, 6.9, 6.10 |
| OTP generation, validity and storage (AC-PWD-03, 04, 05) | 03, 04, 05 | 4.1 to 4.4, 6.4, 6.7 to 6.9, 7.1 |
| Reset password (AC-PWD-06, 08, 09) | 07, 08, 09, 18 | 1.3, 7.2 to 7.4, 7.13 to 7.15 |
| Rejected OTPs (ERR-PWD-02, 03, 04, 06) | 10, 11, 12, 14 | 7.5 to 7.7, 7.9, 7.14 |
| Reset input validation (AC-PWD-06, ERR-PWD-05) | 13, 17 | 1.2, 1.3, 7.8, 7.12, 7.15 |
| Attempt limit (AC-PWD-07, ERR-PWD-07) | 15, 16 | 6.8, 7.10, 7.11, 7.14 |
| OTP delivery by console only (AC-PWD-10) | 19 | 5.1, 5.5, 5.7, 5.8 |
| Test-only OTP file (AC-PWD-11) | 20, 21, 22, 23 | 2.1, 2.3, 5.2 to 5.8 |
| OTP secret configuration (SDS 11.5) | 24 | 2.2, 2.3, 2.4, 2.5 |

## Coverage: scenario to test task

| Scenario | Test task | Scenario | Test task | Scenario | Test task |
| --- | --- | --- | --- | --- | --- |
| S-AB1003-01 | 6.2 | S-AB1003-10 | 7.5 | S-AB1003-19 | 5.1 |
| S-AB1003-02 | 6.3 | S-AB1003-11 | 7.6 | S-AB1003-20 | 5.2 |
| S-AB1003-03 | 6.7 | S-AB1003-12 | 7.7 | S-AB1003-21 | 2.1 |
| S-AB1003-04 | 6.4 | S-AB1003-13 | 7.8 | S-AB1003-22 | 5.4 |
| S-AB1003-05 | 7.1 | S-AB1003-14 | 7.9 | S-AB1003-23 | 5.3 |
| S-AB1003-06 | 6.5 | S-AB1003-15 | 7.10 | S-AB1003-24 | 2.2 |
| S-AB1003-07 | 7.2 | S-AB1003-16 | 7.11 | S-AB1003-25 | 6.6 |
| S-AB1003-08 | 7.3 | S-AB1003-17 | 7.12 | | |
| S-AB1003-09 | 7.4 | S-AB1003-18 | 7.13 | | |

All 9 requirements and all 25 scenarios map to at least one task, and each scenario has exactly one test task. There are no gaps.
