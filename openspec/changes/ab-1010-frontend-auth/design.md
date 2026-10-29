# Design: AB-1010 frontend auth

Follows SDS 9.1 to 9.3 and 9.6. No backend or shared change; every type comes from `@note-app/shared`.

## Modules

| File | Role |
| --- | --- |
| `features/auth/session-store.ts` | Zustand `useAuthStore`: `status` (`unknown`, `authenticated`, `guest`), `user`, `accessToken`; `setSession(auth)`, `clearSession()`. No imports from `lib/`, so no cycle. |
| `lib/api-client.ts` | `apiFetch` reads the token from `useAuthStore.getState()`. New option `auth: false` for auth endpoints (no Bearer, no refresh). Owns `refreshSession()`: one module-level promise, wrapped in `navigator.locks.request('refresh', …)` when available. On `401 UNAUTHORIZED`: `await refreshSession()`, retry once; refresh failure calls `clearSession()` and rethrows. |
| `features/auth/api.ts` | `login`, `register`, `logout` via `apiFetch(..., { auth: false })`, parsed with `AuthResponseSchema`. |
| `features/auth/queries.ts` | `useLoginMutation`, `useRegisterMutation`, `useLogoutMutation` (TanStack mutations; success sets the store; logout also `queryClient.clear()`). |
| `features/auth/components/login-form.tsx`, `register-form.tsx` | react-hook-form + `zodResolver(shared schema)`; `mapServerErrors(error, setError)` maps `details[].path` and `EMAIL_TAKEN`; form-level message for `INVALID_CREDENTIALS` and `NETWORK_ERROR`. Submit `disabled={isPending}`. |
| `features/auth/pages/login-page.tsx`, `register-page.tsx` | Lazy route modules. |
| `routes/guards.ts` | `rootLoader` (bootstrap once while `status === 'unknown'`), `requireAuthLoader`, `guestOnlyLoader` using `redirect`. |
| `routes/auth-layout.tsx`, `routes/app-shell.tsx` | AuthLayout (heading `Note App`, API status footer). AppShell (header with email and Logout; renders `<Navigate to="/login">` when the store turns `guest` mid-session, which covers a failed silent refresh). |
| `routes/notes-placeholder.tsx` | Placeholder `/notes` until AB-1011. |
| `routes/router.ts` | Root route with `loader: rootLoader` and `HydrateFallback`; `/` redirects to `/notes`; `home.tsx` removed. |

## Decisions

- Refresh lives in `api-client.ts` (not in `features/auth`) to avoid a `lib` ↔ `features` import cycle.
- Guards are loaders (SDS 9.1); the AppShell `Navigate` handles the session ending without a navigation.
- Tests mock HTTP with msw only; `navigator.locks` is absent in jsdom, so the fallback path is what the tests run, plus one unit test with a stubbed `locks`.
- Library APIs are checked with Context7 before use: `create<State>()()` (zustand 5), `useForm` / `setError` (react-hook-form 7), `zodResolver` with Zod 4 (@hookform/resolvers 6), `redirect` and lazy routes (react-router 7).

## Test files

| Scenario | File |
| --- | --- |
| S-AB1010-01, S-AB1010-03 | `features/auth/components/register-form.test.tsx`, `login-form.test.tsx` |
| S-AB1010-02 | `features/auth/pages/auth-pages.test.tsx` |
| S-AB1010-04, S-AB1010-06 | `routes/guards.test.tsx` |
| S-AB1010-05 | `lib/api-client.test.ts` |
| S-AB1001-31 (unchanged, still green) | `routes/router.test.tsx` |
