# Design: AB-1003 password reset (forgot-password, OTP, reset)

Spec: `specs/auth/spec.md` (approved 2026-10-29). SDS: sections 4.3, 5.5, 5.6, 6.2, 6.4, 7 (#6 and #7), 10, 11.5, 11.8, 12. ADR-0004. No frontend work in this ticket (AB-1010). The E2E consumer of the OTP file is AB-1016.

No SDS change is needed: the `PasswordResetOtp` model is already in SDS 6.2, endpoints 6 and 7 match `delta-openapi.yaml`, and `OTP_INVALID_OR_EXPIRED` is already in SDS 4.3 and in shared `ErrorCodeSchema`.

## 0. Open points (decide at `/approve plan`)

1. **S-AB1003-22 wording (resolved 2026-10-29).** The first approved scenario ended "for `test` the spy is called once with the sink module path". A type-safe sink loader is a zero-argument function (`() => import('../testing/otp-test-sink.js')`) passed only from the `NODE_ENV === 'test'` branch of `server.ts`, so it has no path argument. The clause "with the sink module path" was removed from S-AB1003-22 in the spec, which now says "the spy is called once", and this plan implements the loader that way. The rejected alternative is a variable-specifier import plus a module-shape type guard; the relative path then resolves against the wrong file.
2. **"Console" delivery.** SDS 5.5 and ADR-0004 say the OTP goes to the console. ESLint has `no-console: error` and `backend/CLAUDE.md` says to use pino. `ConsoleEmailService` takes an injected `write(line)`; `server.ts` wires it to `process.stdout.write`. It does not use pino, so the line appears at every `LOG_LEVEL` (the E2E backend runs at `warn`). **[ASSUMPTION — confirm]**
3. **Default sink path.** When `NODE_ENV=test` and `OTP_TEST_FILE` is unset, the sink writes to the repository-root `e2e/.output/otp.jsonl`, resolved from the sink module's own location. **[ASSUMPTION — confirm]**
4. **`OTP_HMAC_SECRET` is required, with no default** (SDS 11.5). Every caller of `loadEnv` must supply it: `env.test.ts`, `createTestEnv`, and the E2E backend web server. **[ASSUMPTION — confirm]**
5. **Concurrent forgot-password requests.** Two requests at the same instant can each leave one unused OTP. "Latest usable OTP" always means the newest row by `createdAt` then `id`, so only that row can ever be used. **[ASSUMPTION — confirm]**
6. **Expiry boundary.** An OTP is expired when `expiresAt <= now`, so exactly 10 minutes after issue it is rejected (S-AB1003-12 advances the clock by exactly 10 minutes). **[ASSUMPTION — confirm]**

## 1. Files

### 1.1 `packages/shared`

| File | Change |
| --- | --- |
| `src/constants/limits.ts` | Add `OTP_LENGTH` 6, `OTP_TTL_MINUTES` 10, `OTP_MAX_ATTEMPTS` 5. |
| `src/schemas/auth.ts` | Extract the register password rule into an exported `NewPasswordSchema` (8 to 128, a letter, a digit) and use it in `RegisterRequestSchema`. Add `ForgotPasswordRequestSchema` `{ email: EmailSchema }` and `ResetPasswordRequestSchema` `{ email: EmailSchema, otp: z.string().regex(/^\d{6}$/), newPassword: NewPasswordSchema }` (SDS 7.2). The OTP pattern uses `OTP_LENGTH`. |
| `src/schemas/auth.test.ts` | One accepted and one rejected case per rule of the two new schemas, plus a check that `RegisterRequestSchema` still rejects the same passwords (the refactor must not change behaviour). Titles carry no scenario IDs. |
| `src/types.ts`, `src/index.ts` | Add `ForgotPasswordRequest` and `ResetPasswordRequest`. `index.ts` already re-exports the whole `auth.ts`. |

### 1.2 Backend

| File | Change |
| --- | --- |
| `prisma/schema.prisma` | Add `model PasswordResetOtp` exactly as SDS 6.2 and `passwordResetOtps PasswordResetOtp[]` on `User`. |
| `prisma/migrations/<ts>_auth_password_reset_otp/migration.sql` | New, generated then reviewed (section 2). |
| `src/config/env.ts` | Add `OTP_HMAC_SECRET` and optional `OTP_TEST_FILE` (section 4). |
| `src/common/security/hash.ts` | Add `createOtpHasher({ secret })` returning `{ hash(userId, otp), matches(storedHash, userId, otp), verifyDummy(otp) }` (section 3.1). |
| `src/common/security/tokens.ts` | Add `generateOtp(random = randomInt)`. |
| `src/modules/email/email.service.ts` | New. `EmailService` interface `{ sendOtp(email, otp): Promise<void> }`, the `OtpSink` and `OtpSinkModule` types, and `ConsoleEmailService`. |
| `src/modules/email/build-email-service.ts` | New. `buildEmailService({ env, write, clock, loadSink? })` (section 3.2). |
| `src/testing/otp-test-sink.ts` | New. `createOtpTestSink({ filePath?, clock })`. Imports only types from `modules/email` and never from services. Excluded from coverage by the existing config; tested by S-AB1003-20 and S-AB1003-23. |
| `src/modules/auth/auth.repository.ts` | Add the OTP methods (section 3.3) to `methodsFor`, plus `updatePasswordHash`. |
| `src/modules/auth/password-reset.service.ts` | New. `requestOtp` and `resetPassword` (section 3.4). |
| `src/modules/auth/password-reset.controller.ts` | New. `forgotPassword` and `resetPassword`, HTTP only. |
| `src/modules/auth/auth.routes.ts` | Add `POST /forgot-password` and `POST /reset-password`, each with `validate({ body })` and no origin check (SDS 7.1: auth `none`). `createAuthRouter` takes the second controller. |
| `src/app.ts` | `AppDeps` gains `emailService: EmailService` (required, as in `AGENTS.md`) and optional `otpHasher` (a test seam, like `passwordHasher`). Build the service and controller and pass them to the router. |
| `src/server.ts` | Becomes async. Build the email service; pass `loadSink` only inside the `NODE_ENV === 'test'` branch (section 3.2). |
| `tests/support/test-app.ts` | `createTestEnv` adds `OTP_HMAC_SECRET`. `createTestApp` defaults `emailService` to a spy. |
| `tests/support/email.ts` | New. `createSpyEmailService()`: records `{ email, otp }` calls, `otpFor(email)` returns the last one, and an option makes `sendOtp` reject. |
| `src/config/env.test.ts` | Add `OTP_HMAC_SECRET` to `valid` and to the "applies the defaults" expectation. |
| `../e2e/support/env.ts`, `../e2e/playwright.config.ts` | Add `E2E_OTP_HMAC_SECRET` (at least 32 bytes, different from the JWT secret) and pass it as `OTP_HMAC_SECRET` to the backend web server. `OTP_TEST_FILE` is left unset (open point 3); AB-1016 may set it. |

`.env.example` already lists `OTP_HMAC_SECRET` and the `OTP_TEST_FILE` note, so it does not change. No new dependency: `node:crypto` and `node:fs/promises` only.

Layer note: like the other auth repository methods, `findUserByEmail` runs before a user is known. Every new OTP method takes `userId` in its `WHERE`.

### 1.3 Frontend

None.

## 2. Migration and order of steps

1. Shared: limits, schemas, tests, then `pnpm build` so backend sees the new `dist`.
2. Edit `schema.prisma`. Run `pnpm db:up`, then `pnpm --filter backend exec prisma migrate dev --create-only --name auth_password_reset_otp`, **read the SQL**, apply it, then `prisma generate`. The SQL must have: table `PasswordResetOtp` with `otpHash CHAR(64)`, `attempts INTEGER NOT NULL DEFAULT 0`, `timestamptz(3)` columns, index `(userId, createdAt DESC)`, and the foreign key to `User` with `ON DELETE CASCADE`. The CLI writes the migration file itself, so that step needs your [y/n].
3. Env, security helpers (`createOtpHasher`, `generateOtp`), each with unit tests first.
4. Email module and test sink, then `server.ts`.
5. Repository, service, controller, routes, `app.ts`.
6. Test infrastructure (`createTestEnv`, spy email service, e2e env), then the scenario tests. Each test comes before its implementation (`openspec/config.yaml`).
7. At `/pr`: `openspec archive` and the merge of `delta-openapi.yaml` into `docs/api/openapi.yaml`, as `.claude/commands/pr.md` now says. Not part of implementation.

The test database picks the migration up through the existing `globalSetup` (`migrate deploy`).

## 3. Design by layer

### 3.1 Security helpers

- **`generateOtp(random = randomInt)`** returns `random(0, 1_000_000).toString().padStart(6, '0')`. The parameter lets a unit test force a value below 100000 (S-AB1003-03). `randomInt` has no modulo bias (Context7, Node 22).
- **`createOtpHasher({ secret })`.** `hash(userId, otp)` is `createHmac('sha256', secret).update(`${userId}:${otp}`).digest('hex')` (SDS 5.5; 64 hex characters match `CHAR(64)`). `matches(storedHash, userId, otp)` hashes the candidate and compares with `timingSafeEqual` on two `Buffer`s; both are 32 bytes, which `timingSafeEqual` requires, and a stored value of another length returns `false` instead of throwing. `verifyDummy(otp)` runs one `hash` and one `timingSafeEqual` against a fixed dummy user ID and always returns `false`; S-AB1003-14 spies on it.

### 3.2 Email module

- **`ConsoleEmailService({ write, sink? })`.** `sendOtp(email, otp)` calls `write(`password reset code for ${email}: ${otp}`)` (wording **[ASSUMPTION — confirm]**), then `await sink?.({ email, otp })`. The write happens first and is unchanged whether or not a sink exists (S-AB1003-23).
- **`buildEmailService({ env, write, clock, loadSink })`** is async. It returns a plain `ConsoleEmailService` unless `env.NODE_ENV === 'test'` **and** `loadSink` is given; then it calls `loadSink()` once and builds `createOtpTestSink({ filePath: env.OTP_TEST_FILE, clock })` as the sink. For `development` and `production` it never calls `loadSink` (S-AB1003-22, guard 3).
- **`server.ts`** declares `loadSink` only in the test branch: `const loadSink = env.NODE_ENV === 'test' ? () => import('./testing/otp-test-sink.js') : undefined;`. The `import()` expression therefore sits inside the `NODE_ENV === 'test'` branch of `server.ts` (guard 2). `createApp`, services and `ConsoleEmailService` never import the sink; the sink imports only types from the email module.
- **`createOtpTestSink`** creates the directory (`mkdir` with `recursive`), then `appendFile(path, JSON.stringify({ email, otp, issuedAt: clock.now().toISOString() }) + '\n', { mode: 0o600 })`. Context7 confirms `mode` applies only when the file is created, so a pre-existing file keeps its mode; the Playwright fixture truncates the file and AB-1016 owns that. **[ASSUMPTION — confirm]**

### 3.3 Repository (new methods in `methodsFor`)

| Method | Query |
| --- | --- |
| `invalidateUnusedOtps(userId, now)` | `updateMany` where `userId`, `usedAt: null`, `invalidatedAt: null`; set `invalidatedAt`. |
| `createOtp({ userId, otpHash, expiresAt })` | `create`. |
| `findLatestOtp(userId)` | `findFirst` where `userId`, ordered `createdAt desc`, `id desc`. |
| `claimOtpAttempt(id, userId, now, maxAttempts)` | `updateMany` where `id`, `userId`, `usedAt: null`, `invalidatedAt: null`, `expiresAt: { gt: now }`, `attempts: { lt: maxAttempts }`; set `attempts: { increment: 1 }`; returns the count. Prisma `updateMany` with atomic `increment` and `lt` is documented (Context7, Prisma 7 reference). |
| `findOtp(id, userId)` | `findFirst` where `id` and `userId`; used to read the exact `attempts` after a claim. |
| `invalidateOtp(id, userId, now)` | `updateMany` where `id`, `userId`; set `invalidatedAt`. |
| `markOtpUsed(id, userId, now)` | `updateMany` where `id`, `userId`, `usedAt: null`; set `usedAt`; returns the count (the compare-and-set of SDS 5.5). |
| `updatePasswordHash(userId, passwordHash)` | `user.update` where `id: userId`. |

No raw SQL. Reset uses the existing `revokeAllActiveForUser`.

### 3.4 Service (`password-reset.service.ts`)

`createPasswordResetService({ repository, clock, otpHasher, passwordHasher, emailService, logger, generateOtp })`. `generateOtp` defaults to the real one; the unit test injects a fixed one. Time comes only from `clock.now()`.

**`requestOtp(email)`.**
1. `findUserByEmail`. Unknown email: return, nothing else happens (S-AB1003-02).
2. `otp = generateOtp()`. In one transaction: `invalidateUnusedOtps`, then `createOtp` with `otpHasher.hash(user.id, otp)` and `expiresAt = now + OTP_TTL_MINUTES` (S-AB1003-03, 04, 05).
3. After the commit, `await emailService.sendOtp(user.email, otp)` inside a `try/catch`. A rejection is logged as `logger.error({ errorName: error.name }, 'password reset OTP delivery failed')` and swallowed (S-AB1003-25). The catch is a deliberate business rule (the response must not depend on delivery), not a wrapper that rethrows. The log carries neither the OTP nor the email address, and no error message is logged because a delivery error could contain either. Sending after the commit means no OTP is ever delivered for a row that rolled back.

**`resetPassword({ email, otp, newPassword })`.** The route has already validated all three fields (S-AB1003-13, 17), so no attempt is counted for a malformed request.
1. `findUserByEmail`. Unknown: `await otpHasher.verifyDummy(otp)`, then throw the invalid error. No row changes (S-AB1003-14).
2. One transaction returns an outcome and **never throws inside the callback**, so a counted attempt commits (the same pattern as `refresh` in AB-1002; SDS 5.5):
   1. `candidate = findLatestOtp(user.id)`. None: `verifyDummy`, outcome `invalid`.
   2. `claimOtpAttempt(...)`. Count 0 means the OTP is used, invalidated, expired (`expiresAt <= now`) or already at 5 attempts: `verifyDummy`, outcome `invalid` (S-AB1003-10, 12, 16).
   3. `otpHasher.matches(candidate.otpHash, user.id, otp)`. Wrong: `findOtp` for the exact `attempts`; if it is at least `OTP_MAX_ATTEMPTS`, `invalidateOtp`. Outcome `invalid` (S-AB1003-11, 15).
   4. Correct: `markOtpUsed`. Count 0 gives `invalid` (S-AB1003-18). Otherwise hash `newPassword`, `updatePasswordHash`, `revokeAllActiveForUser`, outcome `ok` (S-AB1003-07, 08, 09).
3. After the commit, any outcome other than `ok` throws `AppError('OTP_INVALID_OR_EXPIRED', ...)` from one factory, so the message is identical for every case (S-AB1003-14).

**Why the attempt is claimed before the code is compared.** The claim is one atomic `UPDATE` that also checks `attempts < 5`, so five parallel guesses cannot all read `attempts` below 5 and then all compare. It also serialises concurrent resets on the OTP row, so with two correct resets the second one's claim finds `usedAt` set and fails (S-AB1003-18). The observable effect matches the spec: four wrong attempts and then the correct code succeeds (S-AB1003-15), and after five wrong attempts even the correct code fails (S-AB1003-16). The only difference is that a successful reset also counts as an attempt, which no scenario observes. **[ASSUMPTION — confirm]**

**Argon2 placement.** The new password is hashed inside the transaction, after the OTP matched, so wrong attempts cost no Argon2 work and the row lock is held only on the success path. **[ASSUMPTION — confirm]**

### 3.5 Controller and routes

- `forgotPassword` reads `validBody<ForgotPasswordRequest>(res)`, calls `service.requestOtp`, and answers `res.status(204).end()`. The status, headers and body are the same for every branch (S-AB1003-02). `resetPassword` is the same shape. Neither sets a cookie or returns a token (S-AB1003-08).
- Both routes sit on the existing auth router with `validate({ body: ... })`. They do not use `originCheck`, since the endpoints are public with no cookie. The router-level `INVALID_REFRESH_TOKEN` error handler does not match their errors.
- Request logging does not record bodies, and `REDACT_PATHS` already covers `req.body.newPassword` and `req.body.otp`, so no logging change is needed.

## 4. Configuration (`src/config/env.ts`)

- `OTP_HMAC_SECRET`: `z.string().refine(>= 32 bytes)`. A `superRefine` issue on path `OTP_HMAC_SECRET` when it equals `JWT_ACCESS_SECRET` (S-AB1003-24). An unset value fails as required.
- `OTP_TEST_FILE`: `z.string().min(1).optional()`. A `superRefine` issue on path `OTP_TEST_FILE` when it is set and `NODE_ENV !== 'test'` (S-AB1003-21, guard 1). The existing production-only `superRefine` block is not touched; the new checks run for every environment.
- Because `OTP_HMAC_SECRET` has no default, the callers listed in section 1.2 change with it.

## 5. Requirement to code map

| Requirement | Code |
| --- | --- |
| Forgot-password request | `ForgotPasswordRequestSchema`, route `validate`, controller `forgotPassword`, `requestOtp` step 1 |
| OTP generation, validity and storage | `generateOtp`, `createOtpHasher.hash`, `requestOtp` step 2, `invalidateUnusedOtps` |
| Reset password | `ResetPasswordRequestSchema`, `resetPassword` step 2.4, `revokeAllActiveForUser` |
| Rejected OTPs | `resetPassword` steps 1, 2.1 to 2.3 and 3, one error factory |
| Reset input validation | route `validate` runs before the service |
| Attempt limit | `claimOtpAttempt` guard `attempts < max`, `invalidateOtp` at 5 |
| OTP delivery by console only | `ConsoleEmailService` |
| Test-only OTP file | env guard, `buildEmailService`, `server.ts` branch, `createOtpTestSink` |
| OTP secret configuration | `OTP_HMAC_SECRET` rules in `env.ts` |

## 6. Test strategy

### 6.1 Scenario to test map (one test per ID, title starts with the ID)

| Scenarios | Test file | Level |
| --- | --- | --- |
| S-AB1003-01, 02, 06, 25 | `tests/integration/auth/forgot-password.test.ts` (S-25 uses the spy that rejects and `createLogCapture` to assert no OTP or email in the log) | integration (Supertest, real DB) |
| S-AB1003-04 | same file (reads the row, recomputes the HMAC with the test secret, compares it with a bare SHA-256) | integration |
| S-AB1003-03 | `src/modules/auth/password-reset.service.test.ts` (fake repository, fake clock, injected `generateOtp` returning a value below 100000) | unit |
| S-AB1003-05, 07 to 18 | `tests/integration/auth/reset-password.test.ts` (S-18 uses `Promise.all` on the real database; S-12 uses `createMutableClock`; S-14 injects a spy `otpHasher`) | integration |
| S-AB1003-19, 20, 23 | `src/modules/email/email.service.test.ts` (S-20 writes to a temporary file and checks its mode) | unit |
| S-AB1003-22 | `src/modules/email/build-email-service.test.ts` (spy loader) | unit |
| S-AB1003-21, 24 | `src/config/env.test.ts` | unit |
| (support, no scenario ID) | `auth.test.ts` in shared; `hash.test.ts` (`createOtpHasher`); `tokens.test.ts` (`generateOtp` padding and range) | unit |

Every new scenario has exactly one test, so `pnpm check:scenarios` goes green when the tests exist. Support tests carry no `S-AB1003` ID, so they cannot trip its one-test-per-ID rule.

### 6.2 Risks and how tests cover them

| Risk | Mitigation and test |
| --- | --- |
| A counted attempt is rolled back because an error is thrown inside the transaction | Outcome returned, error thrown after commit. S-AB1003-11 and 15 read `attempts` from the database after a `400`. |
| Parallel guesses beat the 5-attempt limit | Atomic claim with `attempts < 5`. S-AB1003-15 and 16 cover the limit; the compare-and-set race is S-AB1003-18. |
| Two resets with one OTP both succeed | Claim and `markOtpUsed` compare-and-set. S-AB1003-18 on the real database. |
| Account existence leaks through status, headers, message or a DB side effect | One `204` path, one error factory, dummy HMAC for unknown email. S-AB1003-02 and 14. Timing differences on forgot-password stay accepted (SDS 12). |
| A delivery failure changes the response or leaks the OTP or email into the log | Swallowed after commit, error name only. S-AB1003-25. |
| The OTP or its email appears in a log other than the console line | Request logs omit bodies and redact `otp` and `newPassword`. S-AB1003-25 asserts the failure path; S-AB1003-19 asserts the one line that must contain them. |
| The OTP file exists outside `NODE_ENV=test` | Three guards. S-AB1003-21, 22 and 23. |
| The `NewPasswordSchema` refactor changes the register rule | Shared tests keep one case per rule for both schemas; the AB-1002 register tests stay green. |
| Making `OTP_HMAC_SECRET` required breaks existing tests or E2E startup | Section 1.2 lists every caller; the phase checkpoint runs `pnpm build`, `pnpm lint --max-warnings 0` and `pnpm test`. |
| A stored OTP hash of an unexpected length makes `timingSafeEqual` throw | `matches` returns `false` for a length mismatch. Covered by a `hash.test.ts` support test. |
