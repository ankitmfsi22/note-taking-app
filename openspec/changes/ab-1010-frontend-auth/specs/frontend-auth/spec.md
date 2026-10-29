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
