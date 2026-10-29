## Why

AB-1010 is the first frontend ticket. Every page after it needs a signed-in user, so the SPA needs login and register pages, a session that survives a reload, silent token renewal, route guards and logout (FRS 10.1, SDS 9.1 and 9.3). The API side is already on `main` (AB-1002).

## What Changes

- Adds `/login` and `/register` pages (react-hook-form + `zodResolver` with the shared `LoginRequestSchema` and `RegisterRequestSchema`) inside an `AuthLayout`.
- Adds the Zustand session store `useAuthStore` (`unknown` / `authenticated` / `guest`, user and access token in memory only).
- Extends `apiFetch`: Bearer token, one refresh and one retry on `401 UNAUTHORIZED`, single-flight refresh shared by all callers and by tabs (Web Locks), never for auth endpoints.
- Adds session bootstrap in the root loader (`POST /auth/refresh`), the `RequireAuth` and `GuestOnly` guards, `/` → `/notes`, an `AppShell` with Logout, and a placeholder `/notes` page that AB-1011 replaces.
- Adds pinned dependencies `react-hook-form` 7.91.0, `@hookform/resolvers` 6.0.2, `zustand` 5.0.16 and the shadcn `input`, `label` and `card` components (CLI 4.23.0).

## FRS coverage

| FRS requirement | Scenarios |
| --- | --- |
| AC-FEAUTH-01 register and login pages | S-AB1010-01, S-AB1010-02 |
| AC-FEAUTH-02 shared-schema validation, server field errors | S-AB1010-01 |
| AC-FEAUTH-03 submit disabled while in flight | S-AB1010-02 |
| AC-FEAUTH-04 go to the notes list after login or register | S-AB1010-02 |
| AC-FEAUTH-05 session survives reload, silent renewal, login on failure | S-AB1010-04, S-AB1010-05 |
| AC-FEAUTH-06 logout | S-AB1010-06 |
| AC-FEAUTH-07 guards | S-AB1010-06 |
| 10.1 errors: generic credentials message, network retry keeps data | S-AB1010-03 |
| AC-FEAUTH-01 forgot and reset pages, AC-FEAUTH-08 guided flow | S-AB1010-07, S-AB1010-08 |

Authorization-denied: S-AB1010-06 (guest on `/notes` goes to `/login`). Validation failure: S-AB1010-01.

The forgot-password and reset-password pages were added after AB-1003 reached `main` (phase 5).

## Assumptions to confirm

- **[ASSUMPTION — confirm]** If `POST /auth/logout` fails on the network, the client still clears the session and goes to `/login` (the server answers 204 in every other case).
- **[ASSUMPTION — confirm]** Where `navigator.locks` is missing (old browsers, jsdom), the in-tab single flight alone is used.
- **[ASSUMPTION — confirm]** `/notes` is a placeholder page ("Your notes") until AB-1011. The API status line moves from the removed home page to the `AuthLayout` footer.

## Out of scope

Forgot and reset pages until AB-1003 is merged; notes, tags and every other feature page; any backend or shared-schema change.

## Impact

- Frontend only: `frontend/src/features/auth/`, `frontend/src/routes/`, `frontend/src/lib/api-client.ts`, `frontend/package.json`, the root `pnpm-lock.yaml`.
- Capability `frontend-auth` (new). `frontend-shell` is unchanged: S-AB1001-31 still holds at `/`, where the `Note App` heading now comes from the login layout because a guest is redirected. No MODIFIED delta, because `check:scenarios` counts a repeated scenario ID as a duplicate.
- No endpoint, schema or error code changes.

## Rollback

Revert the AB-1010 commits. Nothing persists outside the browser memory and the existing refresh cookie.
