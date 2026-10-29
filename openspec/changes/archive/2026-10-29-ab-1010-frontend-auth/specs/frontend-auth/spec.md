## Purpose
Defines how the web app signs a user in and out, keeps the session across reloads with silent token renewal, and guards pages by session state.

## ADDED Requirements

### Requirement: Register and login forms (AC-FEAUTH-01, AC-FEAUTH-02)
The app SHALL have `/register` and `/login` pages. Each form SHALL validate with the shared `RegisterRequestSchema` or `LoginRequestSchema` before sending, and SHALL show the server's `error.details` (and `409 EMAIL_TAKEN` on the email field) as field errors.

#### Scenario: S-AB1010-01 register validates before sending and shows server field errors
- **WHEN** a visitor submits the register form with email `not-an-email` and password `short`
- **THEN** field errors are shown for `email` and `password` and no request is sent
- **WHEN** the visitor then submits valid values and the server answers `409 EMAIL_TAKEN`, or `400 VALIDATION_ERROR` with `details` naming `password`
- **THEN** the error message is shown on the matching field and the entered values are kept

### Requirement: Successful sign-in (AC-FEAUTH-03, AC-FEAUTH-04)
While a login or register request is in flight the submit button SHALL be disabled and show a loading label. On success the session store SHALL hold the user and access token (memory only) and the app SHALL navigate to `/notes`.

#### Scenario: S-AB1010-02 login and register disable submit, then open the notes list
- **WHEN** a visitor submits valid credentials on `/login`, and separately valid values on `/register`, and the server answers `200` or `201` with `AuthResponseSchema`
- **THEN** the submit button is disabled with a loading label until the response arrives, a second click sends no second request, and the `/notes` page is shown

### Requirement: Sign-in error messages (FRS 10.1 errors)
`401 INVALID_CREDENTIALS` SHALL show one generic message. A network failure SHALL show a retry message and keep the entered values.

#### Scenario: S-AB1010-03 wrong credentials and network failure
- **WHEN** login gets `401 INVALID_CREDENTIALS`
- **THEN** the message "Email or password is incorrect." is shown, naming neither field
- **WHEN** login fails with a network error
- **THEN** a "could not reach the server, try again" message is shown, the email and password fields keep their values, and submitting again sends the request

### Requirement: Session bootstrap (AC-FEAUTH-05)
On app start the root loader SHALL call `POST /auth/refresh` once before any guard runs. `200` SHALL set the session to `authenticated`; `401 INVALID_REFRESH_TOKEN` SHALL set it to `guest`. The access token SHALL never be written to `localStorage`, `sessionStorage` or a readable cookie.

#### Scenario: S-AB1010-04 reload keeps or ends the session
- **WHEN** the app is opened at `/notes` and `POST /auth/refresh` answers `200`
- **THEN** the notes page is shown without the login page appearing first, and web storage holds no token
- **WHEN** the app is opened at `/notes` and refresh answers `401 INVALID_REFRESH_TOKEN`
- **THEN** the login page is shown

### Requirement: Silent token renewal (AC-FEAUTH-05, SDS 9.3)
On `401 UNAUTHORIZED` from a protected call, `apiFetch` SHALL refresh once and retry the call once. Concurrent callers SHALL share one refresh request. Auth endpoints SHALL never trigger a refresh. If the refresh fails, the session SHALL be cleared and the user sent to `/login`.

#### Scenario: S-AB1010-05 expired access token is renewed once, or the user goes to login
- **WHEN** two protected requests get `401 UNAUTHORIZED` at the same time and refresh answers `200`
- **THEN** exactly one `POST /auth/refresh` is sent and both requests are retried with the new Bearer token and succeed
- **WHEN** a protected request gets `401 UNAUTHORIZED` and refresh answers `401 INVALID_REFRESH_TOKEN`
- **THEN** the session is cleared and the login page is shown; a `401` from `POST /auth/login` itself triggers no refresh

### Requirement: Guards and logout (AC-FEAUTH-06, AC-FEAUTH-07)
`RequireAuth` SHALL send a guest to `/login`. `GuestOnly` SHALL send an authenticated user from `/login` or `/register` to `/notes`. Logout SHALL call `POST /auth/logout`, clear the session and the query cache, and show `/login`.

#### Scenario: S-AB1010-06 guards redirect and logout ends the session
- **WHEN** a guest opens `/notes`
- **THEN** the login page is shown (authorization denied)
- **WHEN** an authenticated user opens `/login` or `/register`
- **THEN** the notes page is shown
- **WHEN** an authenticated user clicks Logout
- **THEN** `POST /auth/logout` is sent, the session store is `guest` with no token, the query cache is empty, and the login page is shown

### Requirement: Forgot-password request (AC-FEAUTH-01, AC-FEAUTH-02, AC-FEAUTH-08, AC-PWD-01, AC-PWD-02)
The app SHALL have a `/forgot-password` page whose form validates the email with the shared `ForgotPasswordRequestSchema` before sending. On `204` the app SHALL move to the reset step at `/reset-password`, carrying the submitted email so that step does not ask for it again. **[ASSUMPTION — confirm]** Because the server's `204` is identical whether or not the account exists (AC-PWD-02), the page shows the same next step either way, never revealing account existence.

#### Scenario: S-AB1010-07 forgot-password page sends the email and moves to the reset step
- **WHEN** a visitor submits `not-an-email` on `/forgot-password`
- **THEN** a field error is shown and no request is sent
- **WHEN** the visitor submits a valid email and the server answers `204`
- **THEN** exactly one `POST /auth/forgot-password` request is sent with that email, and the `/reset-password` page is shown with the email field already filled in

### Requirement: Password reset (AC-FEAUTH-01, AC-FEAUTH-02, AC-FEAUTH-08, AC-PWD-06)
The app SHALL have a `/reset-password` page whose form validates with the shared `ResetPasswordRequestSchema` (email, a 6-digit OTP, and a new password following AC-AUTH-03) before sending. `400 OTP_INVALID_OR_EXPIRED` SHALL show one message naming neither the OTP nor the password field (ERR-PWD-02 to ERR-PWD-04, ERR-PWD-06, ERR-PWD-07). On `204` the app SHALL send the user to `/login`.

#### Scenario: S-AB1010-08 reset page with OTP and new password, shows OTP_INVALID_OR_EXPIRED, then goes to login
- **WHEN** a visitor submits a malformed OTP or a password breaking AC-AUTH-03 on `/reset-password`
- **THEN** field errors are shown and no request is sent
- **WHEN** the visitor submits a well-formed email, OTP and new password and the server answers `400 OTP_INVALID_OR_EXPIRED`
- **THEN** one error message is shown naming neither the OTP nor the password field, and the entered OTP and password are kept
- **WHEN** the visitor submits again and the server answers `204`
- **THEN** the `/login` page is shown
