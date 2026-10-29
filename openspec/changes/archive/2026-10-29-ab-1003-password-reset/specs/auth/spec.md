## ADDED Requirements

### Requirement: Forgot-password request (AC-PWD-01, AC-PWD-02, ERR-PWD-01)
`POST /api/v1/auth/forgot-password` SHALL accept an `email` (`ForgotPasswordRequestSchema`) and answer `204` with no body. The status, headers and body SHALL be identical whether or not the email belongs to an account **[ASSUMPTION — confirm]** (FRS A-09). A malformed email SHALL fail with `400 VALIDATION_ERROR` and field-level `details`, and SHALL NOT create an OTP.

#### Scenario: S-AB1003-01 forgot-password for a known email returns 204 and sends the OTP
- **WHEN** a user exists with `ada@example.com` and a visitor posts `{ "email": "ada@example.com" }` to `POST /auth/forgot-password`
- **THEN** the response is `204` with no body, one `PasswordResetOtp` row exists for that user, and the injected `EmailService` received exactly one `sendOtp` call with `ada@example.com` and a 6-digit code

#### Scenario: S-AB1003-02 known and unknown email give an identical response
- **WHEN** a visitor posts the email of an existing account and then the email of an address with no account to `POST /auth/forgot-password`
- **THEN** both responses are `204` with an empty body and the same header names, and for the unknown email no `PasswordResetOtp` row is created and `sendOtp` is not called

#### Scenario: S-AB1003-06 forgot-password with a malformed email returns 400 VALIDATION_ERROR
- **WHEN** a visitor posts `{ "email": "not-an-email" }` to `POST /auth/forgot-password`
- **THEN** the response is `400` with `error.code` `VALIDATION_ERROR`, `error.details` names the field `email`, and no `PasswordResetOtp` row is created

#### Scenario: S-AB1003-25 an email delivery failure does not change the forgot-password response
- **WHEN** a user exists, the injected `EmailService.sendOtp` rejects with an error, and a visitor posts that user's email to `POST /auth/forgot-password`
- **THEN** the response is `204` with an empty body, the same as in S-AB1003-02, the failure is written to the server log, and no log line produced by this request contains the OTP or the email address

### Requirement: OTP generation, validity and storage (AC-PWD-03, AC-PWD-04, AC-PWD-05)
For an existing account the system SHALL generate a 6-digit OTP valid for 10 minutes from the injected `Clock`, usable once, and store it only as an HMAC (SDS 5.5) **[ASSUMPTION — confirm]** (FRS A-08, SDS SA-09). A new OTP SHALL invalidate every earlier unused OTP of that user.

#### Scenario: S-AB1003-03 the OTP is six digits and expires after ten minutes
- **WHEN** a forgot-password request is made at a fixed `Clock` time `T` and the OTP delivered to the `EmailService` is inspected, across a run where the random value is below 100000
- **THEN** the OTP matches `/^\d{6}$/` (zero-padded when below 100000) and the stored `expiresAt` equals `T` plus 10 minutes

#### Scenario: S-AB1003-04 the OTP is stored only as an HMAC
- **WHEN** a forgot-password request is made and the `PasswordResetOtp` row is read
- **THEN** `otpHash` equals `HMAC-SHA256(OTP_HMAC_SECRET, userId + ':' + otp)` in hex for the OTP the `EmailService` received, no column holds the OTP in plain text, and `otpHash` differs from a bare SHA-256 of the OTP

#### Scenario: S-AB1003-05 a new OTP invalidates the earlier unused OTP
- **WHEN** a user requests an OTP twice and then submits the first OTP with a valid new password to `POST /auth/reset-password`
- **THEN** the first row has `invalidatedAt` set, the response is `400` with `error.code` `OTP_INVALID_OR_EXPIRED`, and the second OTP still resets the password with `204`

### Requirement: Reset password (AC-PWD-06, AC-PWD-08, AC-PWD-09)
`POST /api/v1/auth/reset-password` SHALL accept `email`, `otp` and `newPassword` (AC-AUTH-03). On a correct, usable OTP it SHALL in one transaction mark the OTP used, store the new Argon2id hash and revoke all the user's refresh tokens, then answer `204` without logging the user in **[ASSUMPTION — confirm]** (FRS A-10).

#### Scenario: S-AB1003-07 reset with a correct OTP changes the password and uses the OTP
- **WHEN** a user requests an OTP and posts their email, that OTP and a valid new password to `POST /auth/reset-password`
- **THEN** the response is `204` with an empty body, the stored password hash changed and starts with `$argon2id$`, and the OTP row has `usedAt` set to the `Clock` time

#### Scenario: S-AB1003-08 reset revokes every refresh token and does not log in
- **WHEN** a user with two active refresh tokens completes a successful reset
- **THEN** both `RefreshToken` rows have `revokedAt` set, the reset response has no `Set-Cookie` header and no `accessToken`, and `POST /auth/refresh` with either old token returns `401` with `error.code` `INVALID_REFRESH_TOKEN`

#### Scenario: S-AB1003-09 the old password stops working after a reset
- **WHEN** a user completes a successful reset from `OldPass1` to `NewPass2`, then logs in with each password
- **THEN** `POST /auth/login` with `OldPass1` returns `401` with `error.code` `INVALID_CREDENTIALS`, and with `NewPass2` returns `200`

#### Scenario: S-AB1003-18 two concurrent resets with the same OTP succeed only once
- **WHEN** two `POST /auth/reset-password` requests with the same email and correct OTP but different new passwords run in parallel against the real test database
- **THEN** exactly one response is `204` and the other is `400` with `error.code` `OTP_INVALID_OR_EXPIRED`, and the stored hash verifies against the password of the successful request only

### Requirement: Rejected OTPs (ERR-PWD-02, ERR-PWD-03, ERR-PWD-04, ERR-PWD-06)
A wrong, expired, used, invalidated or unknown-account OTP SHALL be rejected with `400 OTP_INVALID_OR_EXPIRED`, the single code SDS 4.3 defines for all of them, so the response does not reveal which case applies. A wrong OTP SHALL increment the attempt counter of the current OTP by one atomically. A reset for an email with no account SHALL return the same status, code and message as a wrong OTP, after one dummy HMAC comparison, and SHALL touch no attempt counter **[ASSUMPTION — confirm]**.

#### Scenario: S-AB1003-10 a used OTP is rejected
- **WHEN** a user completes a successful reset and then posts the same email and OTP again with a valid new password
- **THEN** the second response is `400` with `error.code` `OTP_INVALID_OR_EXPIRED` and the password is unchanged by the second request

#### Scenario: S-AB1003-11 a wrong OTP is rejected and counted
- **WHEN** a user has a current OTP and posts a different 6-digit code with a valid new password
- **THEN** the response is `400` with `error.code` `OTP_INVALID_OR_EXPIRED`, `attempts` on the OTP row is `1`, `usedAt` is null and the password hash is unchanged

#### Scenario: S-AB1003-12 an expired OTP is rejected
- **WHEN** a user requests an OTP, the `Clock` advances by 10 minutes, and the user posts the correct OTP with a valid new password
- **THEN** the response is `400` with `error.code` `OTP_INVALID_OR_EXPIRED`, and the password hash is unchanged

#### Scenario: S-AB1003-14 a reset for an unknown email returns the wrong-OTP error
- **WHEN** a visitor posts an email with no account, any 6-digit OTP and a valid new password to `POST /auth/reset-password`
- **THEN** the response is `400` with the same `error.code` `OTP_INVALID_OR_EXPIRED` and the same `error.message` as in S-AB1003-11, no `PasswordResetOtp` row changes, and the HMAC comparison helper was called once

### Requirement: Reset input validation (AC-PWD-06, ERR-PWD-05)
A reset request whose `email` is malformed, whose `otp` is not exactly 6 digits, or whose `newPassword` breaks AC-AUTH-03 SHALL fail with `400 VALIDATION_ERROR` and field-level `details`. Validation SHALL run before the OTP is read, so a rejected request SHALL NOT count an attempt and SHALL leave the OTP usable **[ASSUMPTION — confirm]** (SDS 5.5).

#### Scenario: S-AB1003-13 a weak new password is rejected and the OTP stays usable
- **WHEN** a user posts the correct OTP with each of these new passwords: `"short1"` (under 8), `"12345678"` (no letter), `"abcdefgh"` (no digit), and a 129-character password
- **THEN** each response is `400` with `error.code` `VALIDATION_ERROR` and `error.details` naming `newPassword`, the OTP row still has `attempts` `0` and `usedAt` null, and a following request with the same OTP and a valid password returns `204`

#### Scenario: S-AB1003-17 an OTP that is not six digits returns 400 VALIDATION_ERROR
- **WHEN** a user posts `otp` values `"12345"`, `"1234567"` and `"12a456"` with a valid new password
- **THEN** each response is `400` with `error.code` `VALIDATION_ERROR` and `error.details` naming `otp`, and `attempts` on the current OTP stays `0`

### Requirement: Attempt limit (AC-PWD-07, ERR-PWD-07)
After 5 wrong OTP attempts for an account the current OTP SHALL be invalidated and further resets SHALL fail with `400 OTP_INVALID_OR_EXPIRED` until a new OTP is requested, even if the correct OTP is submitted **[ASSUMPTION — confirm]** (FRS A-08).

#### Scenario: S-AB1003-15 the fifth wrong attempt invalidates the OTP
- **WHEN** a user submits 4 wrong OTPs, then the correct OTP, on a fresh OTP; and on a second fresh OTP submits 5 wrong OTPs
- **THEN** on the first OTP the correct submission returns `204`; on the second OTP the fifth wrong response is `400` with `error.code` `OTP_INVALID_OR_EXPIRED`, `attempts` is `5` and `invalidatedAt` is set

#### Scenario: S-AB1003-16 after five failures a correct OTP is rejected until a new one is requested
- **WHEN** a user has made 5 wrong attempts, then posts the original correct OTP, then requests a new OTP and posts that one
- **THEN** the original OTP gives `400` with `error.code` `OTP_INVALID_OR_EXPIRED` and the password is unchanged, and the new OTP gives `204`

### Requirement: OTP delivery by console only (AC-PWD-10)
No email SHALL be sent. `ConsoleEmailService.sendOtp(email, otp)` SHALL write the recipient and the OTP to the server console and nothing else, in every environment **[ASSUMPTION — confirm]** (FRS A-11).

#### Scenario: S-AB1003-19 ConsoleEmailService logs the email and OTP to the console
- **WHEN** `ConsoleEmailService.sendOtp("ada@example.com", "042517")` is called with a spy on the console logger
- **THEN** the logger received one line containing `ada@example.com` and `042517`, and no network or SMTP call was made

### Requirement: Test-only OTP file (AC-PWD-11)
Only when `NODE_ENV=test` in the real server entry, the console email service SHALL also append one JSON Lines record per OTP to the file named by `OTP_TEST_FILE`; this SHALL NOT exist or be activatable in any other environment, and the console log SHALL stay unchanged (SDS 5.6, ADR-0004).

#### Scenario: S-AB1003-20 the test sink appends a JSON line per OTP when NODE_ENV is test
- **WHEN** the email service is built for `NODE_ENV=test` with `OTP_TEST_FILE` pointing at a temporary file and `sendOtp("ada@example.com", "042517")` is called twice with different OTPs
- **THEN** the file holds two JSON lines, the last has `email` `ada@example.com`, the second OTP and an ISO `issuedAt` from the `Clock`, and the file mode is `0600`

#### Scenario: S-AB1003-21 the env schema rejects OTP_TEST_FILE outside the test environment
- **WHEN** the `Env` schema parses a configuration with `OTP_TEST_FILE` set and `NODE_ENV` equal to `development`, then to `production`
- **THEN** both parses fail with an error naming `OTP_TEST_FILE`, and the same configuration with `NODE_ENV` equal to `test` parses

#### Scenario: S-AB1003-22 building the email service outside test never imports the sink
- **WHEN** `buildEmailService` is called for `development` and for `production` with an injected, spied import function
- **THEN** the spy is never called and the returned service is a `ConsoleEmailService` without a sink, and for `test` the spy is called once

#### Scenario: S-AB1003-23 the console log is unchanged while the sink is active
- **WHEN** `sendOtp("ada@example.com", "042517")` is called on a service built for `NODE_ENV=test` with a spy on the console logger
- **THEN** the logger received the same single line as in S-AB1003-19, and the sink file received its record

### Requirement: OTP secret configuration (SDS 11.5)
The backend `Env` schema SHALL require `OTP_HMAC_SECRET` of at least 32 bytes and different from `JWT_ACCESS_SECRET`, and startup SHALL fail otherwise.

#### Scenario: S-AB1003-24 the env schema enforces the OTP_HMAC_SECRET rules
- **WHEN** the `Env` schema parses a configuration with `OTP_HMAC_SECRET` missing, then with 31 bytes, then equal to `JWT_ACCESS_SECRET`, then with a distinct 32-byte value
- **THEN** the first three parses fail with an error naming `OTP_HMAC_SECRET` and the last parses
