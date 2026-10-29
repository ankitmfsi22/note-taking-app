## Approach

Playwright (Chromium only) drives the real frontend, backend and `noteapp_e2e` database. No production code changes; everything lives in `e2e/`.

## Decisions

- **Clean state (AC-E2E-04):** a `beforeEach` fixture in `e2e/support/fixtures.ts` truncates all tables (`TRUNCATE ... RESTART IDENTITY CASCADE`) in `noteapp_e2e`, so each test is independent and can run alone or in any order. [ASSUMPTION — confirm] (proposal).
- **OTP (AC-E2E-02):** the backend runs with `NODE_ENV=test` and appends each OTP to `e2e/.output/otp.jsonl` (AC-PWD-11, ADR-0004). A helper `readLatestOtp(email)` reads the newest line for that email. Console output is never parsed. The file is cleared in the same `beforeEach`.
- **Unique users:** each test registers its own user (generated email), so the tests never share data.
- **Public link (S-01, S-04):** a second `browser.newContext()` has no cookies or token, to prove logged-out access.
- **Autosave:** wait on the PATCH response (`page.waitForResponse`), never `waitForTimeout`.
- **Selectors:** `getByRole` / `getByLabel` first; no CSS selectors tied to styling.
- **Dependency:** needs AB-1011 to AB-1015 merged; the journey cannot run before then.

## Tests (one per scenario, title starts with the S-ID)

| File | Scenarios |
| --- | --- |
| `e2e/tests/journey.spec.ts` | S-AB1016-01 |
| `e2e/tests/forgot-password.spec.ts` | S-AB1016-02 |
| `e2e/tests/errors.spec.ts` | S-AB1016-03, S-AB1016-04 |
| `e2e/tests/isolation.spec.ts` | S-AB1016-05 (runs the suite order-independently; single-test and reversed runs in CI script) |
