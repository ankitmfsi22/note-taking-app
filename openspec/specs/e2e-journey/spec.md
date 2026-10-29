# e2e-journey Specification

## Purpose
Defines the Playwright end-to-end suite that proves the main user journeys work across frontend, backend and database in a real browser.

## Requirements

### Requirement: Full user journey (AC-E2E-01)
A Playwright test SHALL run the full journey in a real browser against the running frontend, backend and database, in this order: register, logout, login, create note, edit with autosave, add tag, filter by tag, search with highlight, share, open the public link in a logged-out context, revoke, public link now unavailable, edit again, open version history, restore, delete the note, restore it from Trash, logout.

#### Scenario: S-AB1016-01 the full journey passes end to end
- **WHEN** the journey test runs against a clean database
- **THEN** every step succeeds in order, the public link shows the note while active and "This link is not available" after revoke, the restored version's title and content are shown, the note is absent from the list after delete and back after restore from Trash, and the user ends logged out

### Requirement: Forgot password via the OTP file (AC-E2E-02)
A second test SHALL cover forgot password and reset, reading the OTP from the test-only file `e2e/.output/otp.jsonl` (AC-PWD-11), not from console output. **[ASSUMPTION — confirm]** (A-37)

#### Scenario: S-AB1016-02 reset the password with an OTP read from the test-only file
- **WHEN** a registered user requests a password reset, the test reads the newest OTP for that email from `e2e/.output/otp.jsonl`, submits it with a new password, and logs in with the new password
- **THEN** the reset succeeds, login with the new password succeeds and login with the old password is rejected

### Requirement: Key error paths (AC-E2E-03)
A third test SHALL cover an invalid login and a revoked public link.

#### Scenario: S-AB1016-03 invalid login shows an error and creates no session
- **WHEN** a registered user submits the login form with a wrong password, then opens `/notes`
- **THEN** the form shows the `INVALID_CREDENTIALS` error (`401`), and `/notes` redirects to `/login`

#### Scenario: S-AB1016-04 a revoked public link and a too-short password are rejected
- **WHEN** a user revokes a share link and a logged-out browser opens `/s/:token`, and a visitor registers with a 3-character password
- **THEN** the public page shows the unavailable state (`404 SHARE_LINK_NOT_FOUND`), and registration shows the validation error (`400 VALIDATION_ERROR`) and creates no account

### Requirement: Isolation and browser (AC-E2E-04, AC-E2E-05)
Each test SHALL start from a clean database state and SHALL NOT depend on another test. The suite SHALL pass in the latest Chromium; other browsers are not required. **[ASSUMPTION — confirm]** (A-37)

#### Scenario: S-AB1016-05 tests are independent and run in Chromium
- **WHEN** the suite runs in the Chromium project, once in file order and once with the tests reversed or any single test alone
- **THEN** every test passes in each run, and no test reads data created by another
