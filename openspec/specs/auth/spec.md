# auth Specification

## Purpose
Defines how a visitor registers, logs in, stays signed in with a rotating refresh token and logs out, and how the API recognises an authenticated user from a short-lived access token.

## Requirements

### Requirement: Registration (AC-AUTH-01, AC-AUTH-04, AC-AUTH-11)
`POST /api/v1/auth/register` SHALL accept `email`, `password` and an optional `displayName`, create the user, and answer `201` with an `AuthResponseSchema` body (`user`, `accessToken`, `expiresIn: 900`) and the refresh cookie, so the new user is logged in. The body SHALL NOT contain the password or its hash. An omitted `displayName` is stored and returned as `null` **[ASSUMPTION — confirm]** (SDS 6.2, `PublicUserSchema`).

#### Scenario: S-AB1002-01 register creates the user and logs them in
- **WHEN** a visitor posts a valid `email`, `password` and `displayName` to `POST /auth/register`
- **THEN** the response is `201`, the body parses as `AuthResponseSchema` with `expiresIn` 900 and the same `displayName`, a `Set-Cookie` for `refresh_token` is present, and one `User` row and one active `RefreshToken` row exist for that email

#### Scenario: S-AB1002-02 register without a display name returns null
- **WHEN** a visitor posts a valid `email` and `password` without `displayName`
- **THEN** the response is `201` and `user.displayName` is `null`

#### Scenario: S-AB1002-03 responses never contain a password or hash
- **WHEN** the bodies of `register`, `login` and `refresh` responses for one user are inspected
- **THEN** no body contains the submitted password, the key `passwordHash`, or the stored `$argon2id$` string, and the `user` object has exactly the keys `id`, `email`, `displayName` and `createdAt`

### Requirement: Email is valid, unique and normalised (AC-AUTH-02, ERR-AUTH-01)
The email SHALL be a valid address of at most 254 characters, trimmed and stored in lower case. Uniqueness SHALL be case-insensitive. Registering an existing email SHALL fail with `409 EMAIL_TAKEN` and SHALL NOT create a second account.

#### Scenario: S-AB1002-04 email is trimmed and stored in lower case
- **WHEN** a visitor registers with email `"  Ada.Lovelace@Example.COM "`
- **THEN** the response is `201`, `user.email` is `ada.lovelace@example.com`, and a later login with `ADA.LOVELACE@example.com` succeeds

#### Scenario: S-AB1002-05 duplicate email in any letter case returns 409 EMAIL_TAKEN
- **WHEN** a user exists with `ada@example.com` and a visitor registers with `ADA@Example.com`
- **THEN** the response is `409` with `error.code` `EMAIL_TAKEN`, and the `User` table still has one row for that address

### Requirement: Password rules (AC-AUTH-03, ERR-AUTH-02)
The registration password SHALL be 8 to 128 characters with at least one letter and one digit. Registration with an invalid email or a password that breaks the rule SHALL fail with `400 VALIDATION_ERROR` and field-level `details`. The login password has no strength rule (non-empty, at most 128 characters).

#### Scenario: S-AB1002-06 register with an invalid email returns 400 VALIDATION_ERROR
- **WHEN** a visitor posts `email` `"not-an-email"` with a valid password to `POST /auth/register`
- **THEN** the response is `400` with `error.code` `VALIDATION_ERROR`, `error.details` names the field `email`, and no `User` row is created

#### Scenario: S-AB1002-07 register with a weak password returns 400 VALIDATION_ERROR
- **WHEN** a visitor posts a valid email with each of these passwords: `"short1"` (under 8), `"12345678"` (no letter), `"abcdefgh"` (no digit), and a 129-character password
- **THEN** each response is `400` with `error.code` `VALIDATION_ERROR` and `error.details` names the field `password`

#### Scenario: S-AB1002-08 register with missing fields returns 400 VALIDATION_ERROR
- **WHEN** a visitor posts `{}` to `POST /auth/register`, and separately posts a body with an empty `displayName`
- **THEN** each response is `400` with `error.code` `VALIDATION_ERROR` and `details` listing the missing or invalid fields

### Requirement: Password storage (AC-AUTH-11, FR-X-4)
Passwords SHALL be hashed with Argon2id and the stored value SHALL be a PHC string that starts with `$argon2id$`. The plain password SHALL never be stored, returned or logged. The Argon2 parameters SHALL default to memory 19456 KiB, time cost 2, parallelism 1, and the environment schema SHALL reject lower values when `NODE_ENV=production` (SDS 5.4). The library calls were checked with Context7 (`@node-rs/argon2` `hash(password, options?)`, `verify(hashed, password, options?)`).

#### Scenario: S-AB1002-09 password is stored as an Argon2id hash
- **WHEN** a user registers with password `"correct-horse-9"`
- **THEN** `User.passwordHash` starts with `$argon2id$` and does not contain the password, and verifying the password against it succeeds

#### Scenario: S-AB1002-10 production rejects Argon2 parameters below the minimum
- **WHEN** the environment is loaded with `NODE_ENV=production` and `ARGON2_MEMORY_KIB` below 19456 or `ARGON2_TIME_COST` below 2
- **THEN** loading fails with an error that names the variable, and the same values load when `NODE_ENV` is `test`

#### Scenario: S-AB1002-11 passwords and tokens are not logged
- **WHEN** a client registers, logs in, refreshes and logs out while the request logger captures output
- **THEN** the captured log contains none of the submitted password, the access token, the refresh token value, or the `Cookie` and `Set-Cookie` header values

### Requirement: Login (AC-AUTH-05, AC-AUTH-06, ERR-AUTH-03)
`POST /api/v1/auth/login` with a correct email and password SHALL answer `200` with an `AuthResponseSchema` body and set the refresh cookie. The access token SHALL be an HS256 JWT valid for 15 minutes. The refresh token SHALL be valid for 7 days and SHALL be stored server-side as a SHA-256 hash so that it can be revoked, and the raw token SHALL exist only in the cookie. Login with missing fields SHALL fail with `400 VALIDATION_ERROR`.

#### Scenario: S-AB1002-12 login with correct credentials returns tokens
- **WHEN** a registered user posts the correct email and password to `POST /auth/login`
- **THEN** the response is `200`, the body parses as `AuthResponseSchema` with `expiresIn` 900, and the access token verifies with HS256, issuer `note-app`, audience `note-app-api`, `sub` equal to the user ID and `exp - iat` equal to 900 seconds

#### Scenario: S-AB1002-13 refresh token is stored hashed with a 7-day expiry
- **WHEN** a user logs in at a fixed fake-clock time
- **THEN** one new `RefreshToken` row exists whose `tokenHash` equals the SHA-256 hex of the cookie value, `expiresAt` is exactly 7 days after that time, `revokedAt` is null, and the raw cookie value appears in no column

#### Scenario: S-AB1002-14 refresh cookie has the required attributes
- **WHEN** a user logs in with `NODE_ENV=test`, and again with `COOKIE_SECURE` true
- **THEN** the `Set-Cookie` header is named `refresh_token` with `HttpOnly`, `SameSite=Strict`, `Path=/api/v1/auth` and `Max-Age=604800`, it has `Secure` only in the second case, and the token appears in no JSON body or other header

#### Scenario: S-AB1002-15 login with missing fields returns 400 VALIDATION_ERROR
- **WHEN** a client posts `{}` or `{ "email": "a@b.co" }` to `POST /auth/login`
- **THEN** the response is `400` with `error.code` `VALIDATION_ERROR` and no `RefreshToken` row is created

### Requirement: Login errors do not reveal whether an account exists (AC-AUTH-10, ERR-AUTH-04)
A wrong password and an unknown email SHALL both fail with `401 INVALID_CREDENTIALS` and the identical message. For an unknown email the service SHALL still run one Argon2 `verify` against a fixed dummy hash, so response time does not reveal whether the account exists (SDS 5.4).

#### Scenario: S-AB1002-16 wrong password returns 401 INVALID_CREDENTIALS
- **WHEN** a registered user's email is posted with a wrong password
- **THEN** the response is `401` with `error.code` `INVALID_CREDENTIALS`, no cookie is set and no `RefreshToken` row is created

#### Scenario: S-AB1002-17 unknown email returns the same error as a wrong password
- **WHEN** an email that has no account is posted to `POST /auth/login`
- **THEN** the response status, `error.code` and `error.message` are identical to those of S-AB1002-16, and the Argon2 `verify` function is called once against the dummy hash

### Requirement: Refresh rotates the token (AC-AUTH-07, AC-AUTH-08, ERR-AUTH-05)
`POST /api/v1/auth/refresh` with a valid refresh cookie SHALL, in one transaction, revoke the presented token (compare-and-set) and issue a new refresh token and access token, answering `200` with an `AuthResponseSchema` body and a rotated cookie. A missing, unknown, expired or revoked token SHALL fail with `401 INVALID_REFRESH_TOKEN` and clear the cookie **[ASSUMPTION — confirm]** (a missing cookie counts as unknown).

#### Scenario: S-AB1002-18 refresh rotates the refresh token
- **WHEN** a logged-in client posts to `POST /auth/refresh` with its cookie
- **THEN** the response is `200` with a new access token and a new `refresh_token` cookie whose value differs from the old one, the old row has `revokedAt` set, one new active row exists, and the new token works on a second refresh

#### Scenario: S-AB1002-19 an unknown token returns 401 and revokes nothing
- **WHEN** a client posts to `POST /auth/refresh` with a random token value, and another client posts with no cookie
- **THEN** each response is `401` with `error.code` `INVALID_REFRESH_TOKEN` and a cookie-clearing `Set-Cookie`, and no `RefreshToken` row changed, including the rows of other users

#### Scenario: S-AB1002-20 an expired token returns 401 and revokes nothing
- **WHEN** a user's refresh token is presented after the fake clock passes its `expiresAt`
- **THEN** the response is `401` with `error.code` `INVALID_REFRESH_TOKEN`, and no `RefreshToken` row changed, including the user's other active tokens

#### Scenario: S-AB1002-21 two concurrent refreshes with one token let exactly one win
- **WHEN** two `POST /auth/refresh` requests with the same cookie run at the same time
- **THEN** exactly one response is `200` and the other is `401` with `error.code` `INVALID_REFRESH_TOKEN`, and exactly one new `RefreshToken` row was inserted by the pair

### Requirement: Reuse of a rotated token revokes every session (AC-AUTH-12, ERR-AUTH-05)
Presenting a refresh token that was already rotated (replaced by a newer token through `POST /auth/refresh`) SHALL revoke every active refresh token of the user it belongs to, commit that change, and then fail with `401 INVALID_REFRESH_TOKEN` and a cookie-clearing response. The revoke SHALL be committed before the error is thrown (SDS 5.2). A token revoked by logout is not a rotated token: presenting it SHALL fail with `401 INVALID_REFRESH_TOKEN` and revoke nothing else.

#### Scenario: S-AB1002-22 reuse of a rotated token revokes all of the user's tokens
- **WHEN** a user has two sessions A and B, session A refreshes (rotating its token), and then the old token of A is presented again
- **THEN** the response is `401` with `error.code` `INVALID_REFRESH_TOKEN`, the active tokens of both A (the rotated one) and B now have `revokedAt` set, a later refresh with B's cookie returns `401`, and another user's tokens are untouched

#### Scenario: S-AB1002-23 a logged-out token returns 401 and revokes nothing else
- **WHEN** a user has sessions A and B, session A logs out, and the old cookie of A is then presented to `POST /auth/refresh`
- **THEN** the response is `401` with `error.code` `INVALID_REFRESH_TOKEN` and a cookie-clearing `Set-Cookie`, and session B's token is still active and can still refresh

### Requirement: Logout revokes only the presented token (AC-AUTH-09, ERR-AUTH-06)
`POST /api/v1/auth/logout` SHALL revoke the presented refresh token when it exists and is active, clear the cookie, and answer `204` with no body. It SHALL answer `204` and clear the cookie also when the cookie is missing, unknown or already revoked, and then change no data. Other sessions of the user stay signed in, and the access token expires naturally.

#### Scenario: S-AB1002-24 logout revokes the token and keeps other devices signed in
- **WHEN** a user has sessions A and B and session A posts to `POST /auth/logout` with its cookie
- **THEN** the response is `204` with an empty body and a cookie-clearing `Set-Cookie`, A's token has `revokedAt` set, B's token is still active and B can still refresh

#### Scenario: S-AB1002-25 logout with an unknown, revoked or missing cookie is a no-op success
- **WHEN** a client posts to `POST /auth/logout` with a random token, with an already-revoked token, and with no cookie
- **THEN** each response is `204` with a cookie-clearing `Set-Cookie`, and no `RefreshToken` row changed

### Requirement: Origin check on cookie endpoints (SDS 5.3, SA-05)
`POST /auth/refresh` and `POST /auth/logout` SHALL fail with `403 FORBIDDEN_ORIGIN` when an `Origin` header is present and is not `APP_ORIGIN`, before the cookie is read, and SHALL change no data. An absent `Origin` or one equal to `APP_ORIGIN` SHALL be allowed. `register` and `login` do not use the cookie and have no origin check.

#### Scenario: S-AB1002-26 refresh from a foreign origin returns 403 FORBIDDEN_ORIGIN
- **WHEN** a client posts to `POST /auth/refresh` with a valid cookie and `Origin: https://evil.example`
- **THEN** the response is `403` with `error.code` `FORBIDDEN_ORIGIN` and the token is still active

#### Scenario: S-AB1002-27 logout from a foreign origin returns 403 FORBIDDEN_ORIGIN
- **WHEN** a client posts to `POST /auth/logout` with a valid cookie and `Origin: https://evil.example`
- **THEN** the response is `403` with `error.code` `FORBIDDEN_ORIGIN` and the token is still active

#### Scenario: S-AB1002-28 matching or absent Origin is allowed
- **WHEN** a client posts to `POST /auth/refresh` with a valid cookie and `Origin` equal to `APP_ORIGIN`, and then posts to `POST /auth/logout` with the new cookie and no `Origin` header
- **THEN** the refresh answers `200` and the logout answers `204`, and neither answers `403`

### Requirement: Access token guards protected routes (ERR-AUTH-07, SDS 5.1)
The `requireAuth` middleware SHALL verify the Bearer token with `jose` `jwtVerify` (`algorithms: ['HS256']`, issuer `note-app`, audience `note-app-api`), set `res.locals.userId` from `sub`, and answer `401 UNAUTHORIZED` for any invalid token. Context7 confirmed `SignJWT` (`setIssuer`, `setAudience`, `setExpirationTime`) and `jwtVerify(jwt, key, options)`. The scenarios use a test-app-only route **[ASSUMPTION — confirm]**.

#### Scenario: S-AB1002-29 a protected route without a token returns 401 UNAUTHORIZED
- **WHEN** a client calls a route guarded by `requireAuth` with no `Authorization` header, with `Authorization: Basic abc`, and with `Authorization: Bearer garbage`
- **THEN** each response is `401` with `error.code` `UNAUTHORIZED` and the handler is not called

#### Scenario: S-AB1002-30 expired, wrongly signed and wrong-claim tokens return 401 UNAUTHORIZED
- **WHEN** a client calls a guarded route with: a token whose `exp` has passed on the fake clock, a token signed with another secret, an `alg: none` token, a token signed with HS512, a token with audience `other` and a token with issuer `other`
- **THEN** each response is `401` with `error.code` `UNAUTHORIZED`

#### Scenario: S-AB1002-31 a valid access token reaches the handler with the user ID
- **WHEN** a user logs in and calls a guarded route with the returned `accessToken`
- **THEN** the response is `200` and the handler saw `res.locals.userId` equal to the user's ID

### Requirement: Access token secret length (SDS 5.1)
`JWT_ACCESS_SECRET` SHALL be at least 32 bytes, validated at startup.

#### Scenario: S-AB1002-32 a short JWT secret fails startup
- **WHEN** the environment is loaded with `JWT_ACCESS_SECRET` of 31 bytes, and again with 32 bytes
- **THEN** the first load fails with an error that names `JWT_ACCESS_SECRET` and the second succeeds

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
