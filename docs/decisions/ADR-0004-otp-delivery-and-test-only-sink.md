# ADR-0004: OTP delivery by console log, and a test-only OTP file

- Status: Proposed (approved together with `docs/SDS.md`)
- Date: 2026-10-28
- Tickets: AB-1003 (mechanism), AB-1016 (consumer)
- SDS: Sections 5.5, 5.6, 11.5

## Context

No email is sent (assignment: log to console only). The OTP must still be stored hashed (AC-PWD-04). Playwright cannot reliably read the server's console output, so end-to-end tests need another way to obtain the OTP (FRS A-37, AC-PWD-11). That mechanism must not exist in any environment other than test.

## Decision

- An `EmailService` interface has one production implementation, `ConsoleEmailService`, which logs the recipient and OTP. Its behaviour is the same in every environment (FRS A-11).
- OTPs are stored as `HMAC-SHA256(OTP_HMAC_SECRET, userId + ':' + otp)`. A plain hash of a six-digit number can be brute-forced from a leaked table; the server secret prevents that.
- **Test-only sink.** When the real server starts with `NODE_ENV=test`, `ConsoleEmailService` is given an extra sink that appends one JSON line per OTP to `e2e/.output/otp.jsonl` (file mode `0600`):
  `{"email":"a@b.c","otp":"123456","issuedAt":"..."}`.
- Three guards keep it out of other environments:
  1. `config/env.ts` fails startup if `OTP_TEST_FILE` is set while `NODE_ENV` is not `test`.
  2. The sink module is loaded with a dynamic `import()` inside the `NODE_ENV === 'test'` branch of `server.ts`. `createApp`, services and `ConsoleEmailService` never import it.
  3. Unit tests assert guard 1 and assert that building the email service for `development` or `production` never triggers the import.
- `e2e/support/otp-file.ts` reads the last line for an email and polls for up to 5 seconds. The Playwright fixture truncates the file before each test.

## Consequences

- E2E password-reset tests are deterministic and need no log scraping.
- Integration tests do not use the file; they inject a spy `EmailService` through `createApp(deps)`.
- The sink code is compiled into the build output but cannot run unless the environment says `test`. A production-only exclusion from the build would need a second tsconfig and was judged not worth it.

## Alternatives considered

- **Scrape the server console in Playwright:** rejected (fragile, as the requester noted).
- **A test-only HTTP endpoint that returns the last OTP:** rejected. It would be a network-reachable secret-leaking route that production must also guard against; a local file is not reachable from outside.
- **Return the OTP in the forgot-password response when in test:** rejected; it changes the API contract (the response must be identical for known and unknown emails).
