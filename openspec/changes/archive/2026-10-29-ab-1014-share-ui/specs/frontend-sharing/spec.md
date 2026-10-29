## Purpose
Lets an owner create, copy, list and revoke share links from the app, and lets anyone with a link read the shared note on a public page.

## ADDED Requirements

### Requirement: Share modal creates and lists links (AC-FESHARE-01 to 03, ERR-SHARE-02)
The editor's Share action SHALL open a modal that creates links with an optional `expiresAt`, validated with the shared `CreateShareLinkRequestSchema`, and lists every link of the note with status, expiry and view count. Each active link SHALL show `<origin>/s/<token>` with a copy action and a visible "Copied" confirmation.

#### Scenario: S-AB1014-01 create links with and without expiry, list and copy them, reject a past expiry
- **WHEN** the owner opens the modal, submits an expiry in the past, then submits with no expiry, then submits an expiry 7 days ahead
- **THEN** the past expiry shows a field error and no request is sent; the other two submits send `POST /notes/:noteId/shares` and the list shows two `active` links with expiry (`Never` and the date) and view count `0`
- **WHEN** the owner presses Copy on one link
- **THEN** `navigator.clipboard.writeText` is called with `<origin>/s/<token>` and a "Copied" confirmation appears; and a server `400 VALIDATION_ERROR` for `expiresAt` is shown on the expiry field

### Requirement: Revoke one link after confirmation (AC-FESHARE-04, ERR-SHARE-01, ERR-SHARE-03, ERR-SHARE-04)
Revoke SHALL open the shared `ConfirmDialog`; only on confirm SHALL it call `POST /shares/:shareId/revoke`, after which that link SHALL show `revoked` and the note's other links SHALL stay unchanged. `404 SHARE_LINK_NOT_FOUND` and `404 NOTE_NOT_FOUND` SHALL show a not-found message and refetch the list; a repeated revoke (`200`) SHALL show no error.

#### Scenario: S-AB1014-02 revoke asks for confirmation and leaves other links active
- **WHEN** the owner presses Revoke on link A and cancels
- **THEN** no request is sent and A is still `active`
- **WHEN** the owner presses Revoke on A again and confirms
- **THEN** `POST /shares/:shareId/revoke` is sent, A shows `revoked`, link B still shows `active`; and if the server answers `404 SHARE_LINK_NOT_FOUND` a not-found message is shown and the list is refetched

### Requirement: Active links page (AC-FESHARE-05)
`/shares` SHALL be behind `RequireAuth` and SHALL list the caller's active links (`GET /shares`, paginated) with note title, expiry, view count, copy and a revoke action using the same confirmation, with loading, empty and error-with-retry states. **[ASSUMPTION — confirm]** (A-23)

#### Scenario: S-AB1014-03 active links page lists links across notes and revokes one
- **WHEN** a signed-in user opens `/shares` and `GET /shares` returns two links for two notes
- **THEN** each row shows its `noteTitle`, expiry, view count and a Revoke button
- **WHEN** the user revokes the first row and confirms
- **THEN** the row leaves the list after the refetch; and with an empty result the page shows an empty state

### Requirement: Public shared note page (AC-FESHARE-06, AC-FESHARE-07, ERR-SHARE-09)
`/s/:token` SHALL need no login, send no `Authorization` header, call `GET /public/shares/:token` and render `title`, `content` and `updatedAt` read-only. It SHALL show no editing controls or owner data. `content` SHALL be rendered as React elements using only the `TipTapDocSchema` nodes and marks; it SHALL NOT use `innerHTML`, and any link URL other than `http`, `https` or `mailto` SHALL make `PublicSharedNoteSchema` reject the document and the page show "This link is not available".

#### Scenario: S-AB1014-04 public page renders the note read-only and safely
- **WHEN** a logged-out visitor opens `/s/<token>` and the API returns a note whose text contains `<script>alert(1)</script>`, and, separately, the API returns a note with a link mark with a `javascript:` href
- **THEN** for the first note the title, formatted content and last-updated time are shown, the script text appears as literal text and no script element is created, no `Authorization` header was sent, and no editor, Share, Delete or owner information is on the page; the second note is rejected by `PublicSharedNoteSchema` and the page shows "This link is not available"

### Requirement: Unavailable link state (AC-FESHARE-06, ERR-SHARE-05 to 07)
For any non-200 answer, including `404 SHARE_LINK_NOT_FOUND` for an unknown, revoked, expired or deleted-note link, the public page SHALL show one "This link is not available" state that does not reveal which cause applies.

#### Scenario: S-AB1014-05 public link answered 404 SHARE_LINK_NOT_FOUND shows the unavailable state
- **WHEN** a visitor opens `/s/<token>` and the API answers `404` with `error.code` `SHARE_LINK_NOT_FOUND`
- **THEN** the page shows "This link is not available", no note content, no retry loop and no hint whether the link was unknown, revoked or expired

### Requirement: Authenticated share endpoints need a session (ERR-SHARE-08)
Owner share requests SHALL send the access token. On `401 UNAUTHORIZED` the shared `apiFetch` SHALL refresh once and retry; if the refresh fails the user SHALL be signed out and sent to `/login`. `/shares` SHALL redirect a guest to `/login`.

#### Scenario: S-AB1014-06 401 on a share endpoint ends the session
- **WHEN** the user opens `/shares` and `GET /shares` answers `401 UNAUTHORIZED` and `POST /auth/refresh` also answers `401`
- **THEN** the session becomes `guest`, the app goes to `/login`, and a guest who opens `/shares` directly is redirected to `/login` without calling `GET /shares`
