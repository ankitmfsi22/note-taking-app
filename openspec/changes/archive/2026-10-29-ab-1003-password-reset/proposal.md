## Why

A user who forgot their password must be able to prove they own the account and set a new one (US-PWD-1, US-PWD-2). No email is sent in this project, so the one-time code is delivered by a console log, with a test-only file that lets AB-1016 (E2E) read it (ADR-0004). AB-1003 adds the backend of that flow. The reset screens come with AB-1010.

## What Changes

- Adds the `PasswordResetOtp` table in one Prisma migration (SDS 6.2, 6.4).
- Adds two endpoints: `POST /auth/forgot-password` and `POST /auth/reset-password` (SDS 7, rows 6 and 7). Both answer `204` on success.
- Adds the shared schemas `ForgotPasswordRequestSchema` and `ResetPasswordRequestSchema` in `packages/shared` (SDS 7.2). The new password reuses the AB-1002 password rule.
- Adds OTP generation (`crypto.randomInt`, 6 digits, 10 minutes, single use), storage as `HMAC-SHA256(OTP_HMAC_SECRET, userId + ':' + otp)`, an attempt counter that invalidates the OTP at 5, and invalidation of earlier OTPs on a new request (SDS 5.5).
- Adds one transaction for a successful reset: mark the OTP used with a compare-and-set, store the new Argon2id hash and revoke every refresh token of the user (AC-PWD-08).
- Adds the `EmailService` interface and `ConsoleEmailService` (recipient and OTP to the console in every environment), injected through `createApp({ prisma, clock, emailService, env })`.
- Adds the test-only OTP sink `src/testing/otp-test-sink.ts` with its three guards (SDS 5.6): the env check, the dynamic `import()` in the `NODE_ENV === 'test'` branch of `server.ts`, and the unit tests.
- Adds the environment variables `OTP_HMAC_SECRET` (at least 32 bytes, different from `JWT_ACCESS_SECRET`) and `OTP_TEST_FILE` (only valid when `NODE_ENV=test`) to the backend `Env` schema (SDS 11.5).

## FRS coverage

| FRS requirement | Scenarios |
| --- | --- |
| AC-PWD-01 forgot-password accepts an email | S-AB1003-01, S-AB1003-06 |
| AC-PWD-02 identical response for known and unknown email | S-AB1003-02, S-AB1003-25 |
| AC-PWD-03 6-digit OTP, 10 minutes, single use | S-AB1003-03, S-AB1003-10, S-AB1003-12, S-AB1003-18 |
| AC-PWD-04 OTP stored hashed only | S-AB1003-04 |
| AC-PWD-05 a new OTP invalidates the earlier one | S-AB1003-05 |
| AC-PWD-06 reset takes email, OTP, new password (AC-AUTH-03) | S-AB1003-07, S-AB1003-13, S-AB1003-17 |
| AC-PWD-07 5 wrong attempts invalidate the OTP | S-AB1003-11, S-AB1003-15 |
| AC-PWD-08 reset changes the password, uses the OTP, revokes all refresh tokens, no auto-login | S-AB1003-07, S-AB1003-08 |
| AC-PWD-09 old password stops working | S-AB1003-09 |
| AC-PWD-10 console only, no email | S-AB1003-01, S-AB1003-19, S-AB1003-25 |
| AC-PWD-11 test-only OTP file | S-AB1003-20, S-AB1003-21, S-AB1003-22, S-AB1003-23 |
| ERR-PWD-01 malformed email | S-AB1003-06 |
| ERR-PWD-02 wrong OTP, attempt counted | S-AB1003-11 |
| ERR-PWD-03 expired OTP | S-AB1003-12 |
| ERR-PWD-04 used OTP | S-AB1003-10 |
| ERR-PWD-05 weak new password, OTP stays usable | S-AB1003-13 |
| ERR-PWD-06 unknown email, same error as a wrong OTP | S-AB1003-14 |
| ERR-PWD-07 reset after 5 failed attempts | S-AB1003-16 |
| SDS 5.5 compare-and-set and one transaction | S-AB1003-18 |
| SDS 11.5 `OTP_HMAC_SECRET` rules (environment) | S-AB1003-24 |

Authorization-denied scenario: S-AB1003-14 (both endpoints are public, so the denial is a reset for an email with no account, which gets the same `400 OTP_INVALID_OR_EXPIRED` as a wrong OTP and reveals nothing). Validation-failure scenarios: S-AB1003-06, S-AB1003-13, S-AB1003-17.

## Assumptions to confirm

- **Decided in review (2026-10-29):** a reset for an email with no account touches no attempt counter, because there is no OTP row to count against (S-AB1003-14).
- **Decided in review (2026-10-29):** a correct OTP submitted after the fifth wrong attempt still returns `400 OTP_INVALID_OR_EXPIRED`; the user must request a new OTP (S-AB1003-16).
- **[ASSUMPTION — confirm]** A reset request whose `otp` is not exactly six digits fails `VALIDATION_ERROR` in the Zod layer, before the OTP row is read, so it counts no attempt (S-AB1003-17). SDS 7.2 gives the pattern `/^\d{6}$/`; the attempt rule for it is implied by SDS 5.5, which validates input before touching the OTP.
- **[ASSUMPTION — confirm]** S-AB1003-18 (two parallel resets with the same correct OTP, exactly one succeeds) runs against the real test database, because the compare-and-set can only be proven with a real transaction.
- **[ASSUMPTION — confirm]** S-AB1003-21 to S-AB1003-23 are unit tests with an injected import function and a spy, as SDS 5.6 (guard 3) and ADR-0004 describe. S-AB1003-20 writes to a temporary file path, not to `e2e/.output/otp.jsonl`.
- **[ASSUMPTION — confirm]** "Latest usable OTP" means the newest row that is not used, not invalidated and not expired. S-AB1003-05 asserts the earlier OTP is rejected after a new request.
- **Decided in review (2026-10-29):** if `EmailService.sendOtp` throws for a known email, forgot-password still returns `204`. The failure is only logged, and the log line contains neither the OTP nor the email address, so the response stays identical to the unknown-email response (S-AB1003-25). SDS 5.5 does not cover a delivery failure.

## Out of scope

- The forgot-password and reset pages and their client-side state (AB-1010).
- The E2E journey that reads the OTP file (AB-1016). Only the file mechanism is delivered here.
- Sending real email, OAuth, login throttling or rate limiting on these endpoints, and changing a password while logged in (FRS section 13).
- The purge of expired OTP rows (`HousekeepingJob`, SDS 8.5).
- Any note, tag, search or share endpoint.

## Impact

- Existing capability extended: `auth`.
- API: two endpoints under `/api/v1/auth` (see `delta-openapi.yaml`). Statuses and codes follow SDS 7.1 and 4.3 and are binding: `204`, `400 VALIDATION_ERROR`, `400 OTP_INVALID_OR_EXPIRED`.
- Database: one migration that creates `PasswordResetOtp` (UUIDv7 id, `onDelete: Cascade` from `User`, index on `userId` and `createdAt` descending).
- Shared: two new request schemas. No change to an existing schema.
- Configuration: `OTP_HMAC_SECRET` and `OTP_TEST_FILE` in the `Env` schema and `.env.example`.
- Dependencies: none new (Node `crypto`, the existing `@node-rs/argon2`).
- No change to a binding SDS code or endpoint, so no SDS update is needed.

## Rollback

The migration is additive and only the two new endpoints use the table, so rolling back means reverting the AB-1003 commits and the migration. `PasswordResetOtp` holds short-lived data only. After AB-1010 and AB-1016 depend on the endpoints or the OTP file, a rollback is a new ticket.
