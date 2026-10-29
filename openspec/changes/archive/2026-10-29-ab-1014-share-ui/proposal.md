## Why

AB-1008 shipped the share-link API, but owners have no way to use it from the app. AB-1014 adds the share modal, the active-links page and the public read-only page (FRS 10.5, SDS 9.1 and 9.6). The API side is already on `main`.

## What Changes

- Adds a share modal opened from the editor (the entry point `AC-FEEDIT-09` provides): create a link with an optional expiry (validated with the shared `CreateShareLinkRequestSchema`), list every link of the note with status, expiry and view count, copy a link with a visible confirmation, revoke one link after confirmation with the shared `ConfirmDialog`.
- Adds the `/shares` page (`RequireAuth`, `AppShell`): paginated active links of all notes with note title, expiry, view count and revoke.
- Adds the public `/s/:token` page (no guard, `PublicLayout`): renders title and content read-only, no editing controls, no owner data. Content is rendered from the TipTap JSON as React elements (an allow-listed node and mark renderer); never `innerHTML` or `dangerouslySetInnerHTML`. The access token is not sent.
- Adds `frontend/src/features/sharing/` (`api.ts`, `queries.ts`, components, pages) and the routes in `router.tsx`.

## FRS coverage

| FRS requirement | Scenarios |
| --- | --- |
| AC-FESHARE-01 create links, optional expiry | S-AB1014-01 |
| AC-FESHARE-02 show link, copy with confirmation | S-AB1014-01 |
| AC-FESHARE-03 list every link with status, expiry, views | S-AB1014-01 |
| AC-FESHARE-04 revoke one link after confirmation | S-AB1014-02 |
| AC-FESHARE-05 active links page | S-AB1014-03 |
| AC-FESHARE-06 public page, unavailable state | S-AB1014-04, S-AB1014-05 |
| AC-FESHARE-07 no editing controls, no owner data | S-AB1014-04 |
| ERR-SHARE-01, 03, 04 shown in UI | S-AB1014-02 |
| ERR-SHARE-02 invalid expiry | S-AB1014-01 |
| ERR-SHARE-05 to 07, 09 public unavailable | S-AB1014-05 |
| ERR-SHARE-08 no valid access token | S-AB1014-06 |

Authorization-denied: S-AB1014-06 (401 on an authenticated share endpoint). Validation failure: S-AB1014-01 (past expiry). Error case: S-AB1014-05.

## Assumptions to confirm

- **[ASSUMPTION — confirm]** The expiry input is a date-time picker; the form converts it to an ISO datetime and checks "future, at most 365 days" with the shared schema before sending.
- **[ASSUMPTION — confirm]** A revoked or expired link stays listed in the modal (status badge, no copy or revoke action) and is absent from `/shares`.
- **[ASSUMPTION — confirm]** The `/shares` page keeps `page` in the URL query, like the notes list (SA-48).
- **[ASSUMPTION — confirm]** The public page sends no `Authorization` header and never triggers the 401 refresh flow; every non-200 answer shows one generic "This link is not available" state.

## Out of scope

Any backend, shared-schema or error-code change; the editor, notes list and version drawer (AB-1011, AB-1012, AB-1015) except mounting the existing "Share" action; copying link text from the public page; analytics beyond the view count.

## Impact

- Frontend only: `frontend/src/features/sharing/`, `frontend/src/routes/router.tsx`.
- New capability `frontend-sharing`. No endpoint, schema or error code changes; `delta-openapi.yaml` states this and lists the five endpoints the UI uses.

## Rollback

Revert the AB-1014 commits. Nothing persists outside the existing share-link rows.
