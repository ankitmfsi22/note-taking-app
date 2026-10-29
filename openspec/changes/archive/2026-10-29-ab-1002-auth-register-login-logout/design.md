# Design: AB-1002 auth (register, login, refresh, logout)

Spec: `specs/auth/spec.md` (approved 2026-10-28). SDS: sections 5.1 to 5.4, 6.2, 7 (#2 to #5), 4.3. ADR-0003. No frontend work in this ticket (AB-1010).

## 0. Prerequisite that blocks the plan (decide before `/approve plan`)

The approved spec says only a **rotated** refresh token triggers family revocation (S-AB1002-22), and a logged-out token revokes nothing else (S-AB1002-23). The binding SDS cannot express that today:

- SDS 6.2 `RefreshToken` has only `revokedAt`, so a rotated token and a logged-out token look identical.
- FRS AC-AUTH-12, SDS 4.3 (`INVALID_REFRESH_TOKEN`), SDS 5.2, SA-07 and the endpoint #4 row say "revoked **or** rotated".

This plan **assumes a separate SDS update, done before `/implement`**, that (a) adds one nullable column `rotatedAt timestamptz(3)` to `RefreshToken` in SDS 6.2 and (b) changes the five places above to "rotated". Rotation sets `revokedAt` and `rotatedAt` together; logout and family revocation set only `revokedAt`. **[ASSUMPTION — confirm]** `rotatedAt` is the simplest option; `replacedById` would also record the chain but nothing in the spec needs it. This plan does not edit the SDS or FRS (step 4 of the command). If the update is refused, S-AB1002-22 and S-AB1002-23 cannot both be met and the spec must change instead.

## 1. Files

### 1.1 `packages/shared`

| File | Change |
| --- | --- |
| `src/constants/limits.ts` | New. `EMAIL_MAX` 254, `PASSWORD_MIN` 8, `PASSWORD_MAX` 128, `DISPLAY_NAME_MAX` 100, `ACCESS_TOKEN_TTL_SECONDS` 900, `REFRESH_TOKEN_TTL_DAYS` 7. Schemas and backend services import these, so each value exists once. |
| `src/schemas/auth.ts` | New. `PublicUserSchema`, `RegisterRequestSchema`, `LoginRequestSchema`, `AuthResponseSchema` as in SDS 7.2. |
| `src/schemas/auth.test.ts` | New. One accepted and one rejected case per rule (colocated unit test, titles without scenario IDs). |
| `src/types.ts`, `src/index.ts` | Add the four inferred types and the two new exports. |

Schema details (Zod 4, checked with Context7: `.trim()`, `.toLowerCase()`, `.pipe()`, `z.email()`, `z.iso.datetime()`, `z.literal(900)`):

- `EmailSchema = z.string().trim().toLowerCase().pipe(z.email().max(EMAIL_MAX))`, so the stored form and the unique check use one normalised value (AC-AUTH-02).
- `RegisterRequestSchema`: `password` is `z.string().min(8).max(128)` with `.regex(/\p{L}/u)` and `.regex(/\d/)` (one failing rule gives one detail on `password`). `displayName` is `z.string().trim().min(1).max(100).optional()`. **[ASSUMPTION — confirm]** "letter" means any Unicode letter, "digit" means `0-9`, and length counts Zod code points (the Zod 4 behaviour).
- `LoginRequestSchema`: `EmailSchema` plus `password` `min(1).max(128)` and no strength rule.
- `PublicUserSchema`: `{ id: IdSchema, email, displayName: string or null, createdAt: z.iso.datetime() }`.
- `AuthResponseSchema`: `{ user, accessToken: z.string(), expiresIn: z.literal(900) }`.

### 1.2 Backend

| File | Change |
| --- | --- |
| `prisma/schema.prisma` | Add `User` and `RefreshToken` from SDS 6.2 plus `rotatedAt` (section 0). Leave out the relations to `PasswordResetOtp`, `Note` and `Tag`; their tickets add them. |
| `prisma/migrations/<ts>_auth_user_refresh_token/migration.sql` | New, generated then reviewed (section 2). |
| `src/config/env.ts` | Add `JWT_ACCESS_SECRET`, `APP_ORIGIN`, `COOKIE_SECURE`, `ARGON2_MEMORY_KIB`, `ARGON2_TIME_COST` (section 4.1). |
| `src/common/security/tokens.ts` | New. Access JWT sign and verify, refresh token generate and hash. |
| `src/common/security/hash.ts` | New. `createPasswordHasher(params)` returning `{ hash, verify }`. |
| `src/common/http/origin-check.ts` | New. `createOriginCheck(appOrigin)` middleware. |
| `src/common/http/require-auth.ts` | New. `createRequireAuth({ secret, clock })` middleware. |
| `src/common/http/validate.ts` | Add a typed accessor `validBody<T>(res)` that reads `res.locals.valid.body`. Backend cannot import `zod` at runtime, so the controller gets the type from `@note-app/shared` and does not re-parse. |
| `src/modules/auth/auth.repository.ts` | New. Prisma access only (section 3.2). |
| `src/modules/auth/auth.service.ts` | New. Rules and transactions (section 3.3). |
| `src/modules/auth/auth.controller.ts` | New. HTTP only (section 3.4). |
| `src/modules/auth/auth.routes.ts` | New. `createAuthRouter(deps)`. |
| `src/modules/auth/refresh-cookie.ts` | New. Cookie name, options and the set and clear helpers. |
| `src/app.ts` | Build the auth module from `deps` and mount it at `/api/v1/auth`. Add optional `passwordHasher` to `AppDeps` as a test seam (S-AB1002-17). |
| `src/server.ts` | No change expected; it already passes `env`, `clock`, `prisma`. |
| `package.json` | Add exact-version dependencies `jose` 6.2.13, `@node-rs/argon2` 2.2.2, `cookie-parser` 1.4.7 and dev `@types/cookie-parser` 1.4.10 (SDS 3.2). `pnpm add -E`, never `@latest`. |
| `tests/setup/global-setup.ts`, `tests/support/db.ts` | New (section 5.1). `vitest.config.ts` gets `globalSetup`. |
| `tests/support/test-app.ts` | Add the new env values to `createTestApp`, a mutable clock, and a `registerUser` helper. |
| `e2e/playwright.config.ts` | The backend web server needs `JWT_ACCESS_SECRET` and `APP_ORIGIN` now that they are required. Use test-only constants from `e2e/support/env.ts`. |

Layer exception: Rule 3 (every repository method takes `userId`) cannot apply before a user is known. The auth repository looks up a user by email and a refresh token by its hash (the credential itself). Every method that acts on an already-identified user (`revokeAllActiveForUser`) takes `userId`. **[ASSUMPTION — confirm]**

### 1.3 Frontend

None. AB-1010 owns login and register pages, the in-memory token and `apiFetch` refresh.

## 2. Migration and order of steps

1. Update the SDS (section 0), outside this ticket.
2. Shared schemas, then `pnpm build` so backend sees `dist`.
3. Edit `schema.prisma`. Start `pnpm db:up`. Run `pnpm --filter backend exec prisma migrate dev --create-only --name auth_user_refresh_token` against `noteapp_dev`, **read the SQL** before applying, then `prisma migrate dev` and `prisma generate`. Check the SQL has: `User.email` unique, `RefreshToken.tokenHash` unique `CHAR(64)`, indexes on `userId` and `expiresAt`, `ON DELETE CASCADE`, and `timestamptz(3)` columns. The CLI writes the migration file itself (it is the only way to get a valid timestamped migration), so this step needs your [y/n] to run the command.
4. Dependencies, env, security helpers, http middleware.
5. Auth module bottom-up: repository, service, controller, routes, `app.ts`.
6. Test infrastructure, then tests per scenario (each test before its implementation, per `openspec/config.yaml`).
7. Archive time (`/pr`): `openspec archive` merges `delta-openapi.yaml` into `docs/api/openapi.yaml`. Not part of implementation.

The test database gets the migration through `globalSetup` (`migrate deploy`), so no manual step.

## 3. Design by layer

### 3.1 Security helpers (`common/security`)

- **Access token (SDS 5.1, Context7-verified `SignJWT`, `jwtVerify`, `currentDate`).** `signAccessToken({ userId, now, secret })` builds `new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuer('note-app').setAudience('note-app-api')` and sets `iat` and `exp` from explicit numbers computed from the injected `Clock` (`iat = floor(now / 1000)`, `exp = iat + 900`), so `exp - iat` is exactly 900 (S-12) and a fake clock works. `verifyAccessToken(token, secret, now)` calls `jwtVerify(token, key, { algorithms: ['HS256'], issuer, audience, currentDate: now })`; any thrown `jose` error becomes `AppError('UNAUTHORIZED')`. The key is `new TextEncoder().encode(secret)`, built once. `alg: none`, HS512 and wrong-secret tokens fail at `algorithms` or signature.
- **Refresh token.** `generateRefreshToken()` is `randomBytes(32).toString('base64url')`. `hashRefreshToken(token)` is `createHash('sha256').update(token).digest('hex')` (64 chars, matches `CHAR(64)`).
- **Passwords (`hash.ts`, Context7-verified `hash` and `verify` from `@node-rs/argon2`).** `createPasswordHasher({ memoryCost, timeCost })` returns `{ hash(password), verify(hash, password) }`, passing `{ memoryCost, timeCost, parallelism: 1 }` and no `algorithm` (the `const enum` issue, SA-47; Argon2id is the library default and a unit test asserts the `$argon2id$` prefix, S-09). The dummy hash for the unknown-email path is computed lazily once from the same parameters, so the timing of the dummy `verify` matches a real one. SA-08 says "fixed dummy hash"; computing it at first use keeps the parameters equal even when env changes them. **[ASSUMPTION — confirm]**

### 3.2 Repository (`auth.repository.ts`)

`createAuthRepository(prisma)` returns methods bound to a client and a `transaction(fn)` method that calls `prisma.$transaction(async (tx) => fn(methodsFor(tx)))`, so the service owns the transaction boundary while only the repository touches Prisma (checked locally against Prisma 7.10.1: `$transaction` with `isolationLevel` exists; the Context7 hit for "Prisma" described a newer `db.transaction` API and was not used).

Methods: `findUserByEmail(email)`, `createUser({ email, passwordHash, displayName })` (returns `null` on a unique violation, mapping Prisma `P2002`, so the service throws `EMAIL_TAKEN` without importing Prisma), `createRefreshToken({ userId, tokenHash, expiresAt })`, `findRefreshTokenByHash(tokenHash)` (with its user), `rotateRefreshToken(id, now)` (`updateMany` where `id` and `revokedAt: null`, set `revokedAt` and `rotatedAt`, returns the count), `revokeActiveToken(tokenHash, now)` (`updateMany` where `tokenHash` and `revokedAt: null`), `revokeAllActiveForUser(userId, now)`.

### 3.3 Service (`auth.service.ts`)

`createAuthService({ repository, clock, passwordHasher, accessTokenSecret, refreshTtlDays })`. Time comes only from `clock.now()`.

- **register.** Fast path `findUserByEmail`; hash the password; in one transaction `createUser` then `createRefreshToken`; a `null` from `createUser` (race) also gives `EMAIL_TAKEN`. Returns `{ user, accessToken, refreshToken }`. The raw refresh token goes only to the controller for the cookie.
- **login.** `findUserByEmail`. If missing, run `passwordHasher.verify(DUMMY_HASH, password)` once and throw `INVALID_CREDENTIALS`. If present, verify the real hash; mismatch throws the same error with the same message (S-16, S-17). Success creates a refresh token row and signs an access token.
- **refresh.** One transaction returns a discriminated outcome and **no error is thrown inside the callback**, so the revoke commits first (SDS 5.2):
  1. Find by hash. Missing gives `invalid`.
  2. `rotatedAt` set gives `reuse`: `revokeAllActiveForUser`, outcome `reuse`.
  3. `revokedAt` set (logout or earlier family revocation) or `expiresAt <= now` gives `invalid`, nothing else changes (S-19, S-20, S-23).
  4. `rotateRefreshToken` compare-and-set. Count 1 means create the new token and outcome `rotated`. Count 0 means a concurrent request won: re-read the row, and if `rotatedAt` is now set treat it as `reuse`, else `invalid`.
  After the transaction returns, `reuse` and `invalid` throw `AppError('INVALID_REFRESH_TOKEN')`.
  **Concurrency consequence.** The loser of two concurrent refreshes takes the `reuse` branch, so the winner's new token is revoked too. That is the "known cost" in SDS 5.2 and SDS 10.5 ("all revoked afterwards"). The spec (S-21) asserts one `200`, one `401` and one new row; the test also asserts the tokens are revoked afterwards, as SDS 10.5 requires. **[ASSUMPTION — confirm]**
- **logout.** `revokeActiveToken(hash, now)` when a cookie is present, no result check. Never throws for token state.

### 3.4 Controller, routes, middleware

- **Controller.** `register`, `login`, `refresh`, `logout`. Reads `validBody` or the cookie, calls one service method, parses the response with `AuthResponseSchema.parse` (this strips any stray `passwordHash`, S-03), sets the cookie, sends the status. `logout` sends `204` with no body.
- **Cookies (`refresh-cookie.ts`).** `res.cookie('refresh_token', token, { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: 'strict', path: '/api/v1/auth', maxAge: 7 * 24 * 3600 * 1000 })`; Express converts `maxAge` to `Max-Age=604800` (Context7-verified from `res.cookie`). **Clearing uses `res.cookie(name, '', { ...sameOptions, maxAge: 0 })`, not `res.clearCookie`**: Context7 shows `clearCookie` deletes `maxAge` and sets only `Expires`, which would not give the `Max-Age=0` that SDS 5.3 requires. The attributes must match the set cookie, so one options builder serves both.
- **Routes (`createAuthRouter`).** `cookieParser()` on this router only (SDS lists `cookie-parser` for the refresh cookie; scoping it keeps it off other routes). `POST /register` and `/login` use `validate({ body })`. `POST /refresh` and `/logout` use `originCheck` first (before the cookie is read) and no body schema. A router-level error handler after `/refresh` clears the cookie when the error is `AppError` with code `INVALID_REFRESH_TOKEN`, then calls `next(err)`; the global error middleware still builds the body. This is standard Express error handling, not a try/catch wrapper.
- **`createOriginCheck(appOrigin)`.** If an `Origin` header is present and not equal to `new URL(env.APP_ORIGIN).origin`, throw `AppError('FORBIDDEN_ORIGIN')`. An absent header passes. The literal `Origin: null` is present and not equal, so it is refused.
- **`createRequireAuth({ secret, clock })`.** Accept only `Authorization: Bearer <token>` (case-sensitive scheme, one space); anything else is `UNAUTHORIZED`. On success set `res.locals.userId = payload.sub`. A non-string or missing `sub` is `UNAUTHORIZED`.

### 3.5 Wiring (`app.ts`)

`createApp` creates the repository, service and controller from `deps.prisma`, `deps.clock`, `deps.env` and `deps.passwordHasher ?? createPasswordHasher(env params)`. Modules never import `env` or the Prisma singleton.

## 4. Configuration

### 4.1 `Env` additions (`src/config/env.ts`, the one allowed runtime Zod use)

- `JWT_ACCESS_SECRET`: required, `Buffer.byteLength(value) >= 32` (S-32).
- `APP_ORIGIN`: required `z.url()`. The origin check compares against `new URL(value).origin`.
- `COOKIE_SECURE`: `'true' | 'false'` mapped to a boolean, default `false`. **[ASSUMPTION — confirm]** In production it must be `true` (SDS 11.5 says "`true` in production"); startup fails otherwise.
- `ARGON2_MEMORY_KIB` (default 19456) and `ARGON2_TIME_COST` (default 2), coerced integers. With `NODE_ENV=production`, lower values fail with the variable name (S-10). Tests use small values (memory 1024, time 1).
- `JWT_ACCESS_SECRET` and `APP_ORIGIN` having no default means every caller of `loadEnv` must supply them: `env.test.ts` (its "applies the defaults" test and a new `valid` object), `createTestApp`, and the e2e backend web server. This is a deliberate fail-fast choice (SDS 11.5).

## 5. Test strategy

### 5.1 Infrastructure (new)

- `tests/setup/global-setup.ts`: runs `prisma migrate deploy` once against `TEST_DATABASE_URL` (child process with `DATABASE_URL` set). The `db-test` container must be up (`pnpm db:up`).
- `tests/support/db.ts`: `useTestDatabase()` returns a Prisma client, registers `beforeEach` to `TRUNCATE` every table except `_prisma_migrations` (`RESTART IDENTITY CASCADE`, table names read from `pg_tables` through a `pg` client), and `afterAll` to disconnect. SDS 10.2 describes a global `beforeEach`; a helper called by each integration file is simpler and keeps unit tests off the database. **[ASSUMPTION — confirm]**
- Fake clock: `createMutableClock(iso)` with `advanceMs`, used by S-13, S-20, S-30. The existing `fixedClock` stays.

### 5.2 Scenario to test map

| Scenarios | Test file | Level |
| --- | --- | --- |
| S-AB1002-01 to 05, 08, 09 | `tests/integration/auth/register.test.ts` | integration (Supertest, real DB) |
| S-AB1002-06, 07 | same file | integration; the rule table also has colocated schema unit tests |
| S-AB1002-12 to 17 | `tests/integration/auth/login.test.ts` (S-17 injects a spy `passwordHasher`) | integration |
| S-AB1002-18 to 23 | `tests/integration/auth/refresh.test.ts` (S-21 uses `Promise.all` on the real DB) | integration |
| S-AB1002-24, 25 | `tests/integration/auth/logout.test.ts` | integration |
| S-AB1002-26 to 28 | `tests/integration/auth/origin-check.test.ts` | integration |
| S-AB1002-03 | `tests/integration/auth/responses.test.ts` (register, login and refresh bodies) | integration |
| S-AB1002-11 | `tests/integration/auth/logging.test.ts` (captures pino output across all four calls) | integration |
| S-AB1002-10, 32 | `src/config/env.test.ts` | unit |
| S-AB1002-29, 30 | `src/common/http/require-auth.test.ts` (test-local Express app with `requireAuth` and the real error handler) | unit |
| S-AB1002-31 | `tests/integration/auth/require-auth.test.ts` (log in on `createApp`, call the test-local guarded app built with the same secret and clock) | integration |
| (support) | `tokens.test.ts`, `hash.test.ts`, `origin-check.test.ts`, `auth.service.test.ts` with a fake repository | unit |

S-AB1002-09 asserts the stored hash prefix in an integration test that reads the row. One test per scenario ID, titles `S-AB1002-nn: ...`. S-29 to S-31 need no production seam: the guarded route lives in a test-local Express app, so nothing in `app.ts` exists only for tests (this keeps the spec's "test-app-only route" assumption and avoids a test hook in production code). **[ASSUMPTION — confirm]**

## 6. Requirement to code map

| Spec requirement | Code |
| --- | --- |
| Registration (AC-AUTH-01, 04, 11) | `RegisterRequestSchema`, `auth.service.register`, `AuthResponseSchema.parse` in the controller |
| Email valid, unique, normalised (AC-AUTH-02, ERR-AUTH-01) | `EmailSchema`; unique index; `createUser` returning `null` on `P2002` |
| Password rules (AC-AUTH-03, ERR-AUTH-02) | `RegisterRequestSchema` and `validate()` |
| Password storage (AC-AUTH-11, FR-X-4) | `hash.ts`; env minimums; existing pino `REDACT_PATHS` (already covers `authorization`, `cookie`, `set-cookie`, `req.body.password`) |
| Login (AC-AUTH-05, 06, ERR-AUTH-03) | `service.login`, `tokens.ts`, `refresh-cookie.ts`, `RefreshToken` table |
| Login errors (AC-AUTH-10, ERR-AUTH-04) | one `AppError('INVALID_CREDENTIALS')` message; dummy `verify` |
| Refresh rotates (AC-AUTH-07, 08, ERR-AUTH-05) | `service.refresh` outcomes `rotated` and `invalid`; `rotateRefreshToken` compare-and-set |
| Reuse of a rotated token (AC-AUTH-12) | `rotatedAt` check, `revokeAllActiveForUser`, throw after commit |
| Logout (AC-AUTH-09, ERR-AUTH-06) | `service.logout`, `revokeActiveToken`, clear cookie always |
| Origin check (SA-05) | `origin-check.ts` before the cookie read |
| Access token guard (ERR-AUTH-07) | `require-auth.ts`, `verifyAccessToken` |
| Secret length (SDS 5.1) | `env.ts` |

## 7. Risks and how tests cover them

| Risk | Mitigation and test |
| --- | --- |
| SDS cannot tell rotated from logged-out (section 0) | Block `/implement` until the SDS update lands. S-22 and S-23 fail without `rotatedAt`. |
| Revoke rolled back because the error is thrown inside the transaction | Outcome-returning callback, throw after commit. S-22 reads the DB after the `401` and asserts the other session is revoked. |
| Concurrent refresh lets both win | Compare-and-set `updateMany` with `count === 1`. S-21 on the real database. |
| Cookie not cleared because attributes differ | One options builder for set and clear, and `maxAge: 0` instead of `clearCookie`. S-14 and S-19 assert the header attributes and `Max-Age=0`. |
| Login timing reveals unknown emails | Dummy verify with identical parameters. S-17 spies on `verify`. A timing assertion is deliberately not used (flaky). |
| Secrets in logs | Existing redaction plus S-11, which scans captured output for the password, both tokens and the `Cookie` and `Set-Cookie` values. |
| Weak or short secrets reach production | Startup validation. S-10 and S-32. |
| Existing tests break on the new required env | Update `env.test.ts`, `createTestApp`, e2e config in the same batch; `pnpm build`, `pnpm lint --max-warnings 0` and `pnpm test` run at each checkpoint. |
| Argon2 makes the suite slow | Test env uses memory 1024 and time cost 1. |
| `@node-rs/argon2` `const enum` breaks under `isolatedModules` | Do not pass `algorithm`; S-09 asserts the `$argon2id$` prefix (SA-47). |
| Test database not running | `globalSetup` fails with a message that names `pnpm db:up`. |

## 8. Out of scope for the plan

The SDS and FRS edits of section 0, the OTP table and password reset (AB-1003), `HousekeepingJob` purge of expired refresh tokens, frontend work, merging `delta-openapi.yaml` into `docs/api/openapi.yaml` (done by `/pr` at archive).
