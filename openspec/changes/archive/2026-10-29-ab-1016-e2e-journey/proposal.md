## Why

Unit, integration and component tests cover each feature in isolation. AB-1016 proves the whole product works together in a real browser against the running frontend, backend and database (FRS section 11).

## What Changes

- Adds Playwright tests under `e2e/tests/` (Chromium only, database `noteapp_e2e`).
- Test 1, full journey (AC-E2E-01): register, logout, login, create note, edit with autosave, add tag, filter by tag, search with highlight, share, open the public link in a logged-out context, revoke, public link unavailable, edit again, open version history, restore, delete the note, restore it from Trash, logout.
- Test 2, forgot password (AC-E2E-02): request an OTP, read it from `e2e/.output/otp.jsonl` (AC-PWD-11), reset the password, log in with the new one.
- Test 3, error paths (AC-E2E-03): invalid login, and a revoked public link.
- Each test starts from a clean database and is independent (AC-E2E-04).
- No production code changes. Test support code lives in `e2e/support/`.

## FRS coverage

| FRS requirement | Scenarios |
| --- | --- |
| AC-E2E-01 full journey | S-AB1016-01 |
| AC-E2E-02 forgot password via OTP file | S-AB1016-02 |
| AC-E2E-03 invalid login, revoked public link | S-AB1016-03, S-AB1016-04 |
| AC-E2E-04 clean database, independent tests | S-AB1016-05 |
| AC-E2E-05 latest Chromium | S-AB1016-05 |

Authorization-denied: S-AB1016-03 (invalid login `401 INVALID_CREDENTIALS`, no session). Validation failure: S-AB1016-04 (registration with a too-short password shows `400 VALIDATION_ERROR`).

## Assumptions to confirm

- **[ASSUMPTION — confirm]** Depends on AB-1011 to AB-1015 being merged, since the journey needs the notes list, editor, search, share and version UI. Not startable before then.
- **[ASSUMPTION — confirm]** Clean state means truncating all tables before each test through a helper that connects to `noteapp_e2e` (FRS A-37 fixes the database, not the mechanism).
- FRS A-37 (clean database per test, Chromium only, OTP from the test-only file) is already flagged.

## Out of scope

Other browsers, visual regression, performance tests, any production code change, real email.

## Impact

`e2e/tests/`, `e2e/support/`. Capability `e2e-journey` (new). No endpoint, schema or error code changes.

## Rollback

Revert the AB-1016 commits. No production code is affected.
