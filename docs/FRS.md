# Functional Requirements Specification (FRS) — Note Taking App

| Field | Value |
| --- | --- |
| Status | DRAFT — awaiting human approval |
| Source | `docs/reference/ASSIGNMENT.md` (wins over any other source) |
| Tickets covered | AB-1001 to AB-1016 |
| Companion document | `docs/SDS.md` (not yet written) |

This document says **what** the system must do. How it is built (schema, API shapes, status codes) belongs in the SDS.

Every detail that the assignment does not state is marked **[ASSUMPTION — confirm]** and carries an ID such as `(A-07)`. All assumptions are listed together in [Section 12](#12-assumptions-to-confirm).

Wording: **SHALL** = mandatory.

---

## 1. Scope

A full-stack note taking application. Authenticated users create, organise, search and share notes. It provides CRUD, tags, full-text search, public read-only share links and per-note version history.

### 1.1 Tech stack (fixed, from the assignment)

| Layer | Technology |
| --- | --- |
| Frontend | React 19 + TypeScript + Vite + TanStack Query + Zustand + TipTap + shadcn/ui |
| Backend | Node.js 22 + Express 5 + TypeScript |
| Database | PostgreSQL 16 + Prisma ORM |
| Auth | JWT access token (15 min) + refresh token (7 days, stored in DB) |
| Search | PostgreSQL Full-Text Search, no external service |
| Testing | Vitest + Supertest + Playwright |
| Monorepo | pnpm workspaces |

### 1.2 Glossary

| Term | Meaning |
| --- | --- |
| User | A registered, authenticated person. Owns notes, tags and share links. |
| Note | A titled rich-text document owned by exactly one user. |
| Soft delete | Setting `deletedAt` on a note. The row is never physically removed within the 30-day recovery window. |
| Version | An immutable snapshot of a note's title and content, numbered per note. |
| Share link | A public, unauthenticated, read-only URL to one note. |
| OTP | One-time password used to reset a forgotten password. |

### 1.3 Cross-cutting rules (apply to every feature)

- **FR-X-1** A user SHALL only ever read or change their own notes, tags, versions and share links. Another user's resource SHALL be indistinguishable from a non-existent one.
- **FR-X-2** Every protected operation SHALL require a valid access token. Missing, invalid or expired tokens SHALL be rejected.
- **FR-X-3** All input SHALL be validated. Invalid input SHALL be rejected with a field-level explanation and SHALL NOT change any data.
- **FR-X-4** Passwords, refresh tokens and OTPs SHALL never be stored or logged in plain text. The only exceptions are the OTP console log in AC-PWD-10, which stands in for email, and the test-only OTP file in AC-PWD-11.
- **FR-X-5** Errors SHALL use one consistent response shape (defined in the SDS).
- **FR-X-6** Concurrent saves to one note: last write wins, no conflict detection. **[ASSUMPTION — confirm]** (A-39)

---

## 2. Feature 1 — Auth: register, login, logout (AB-1002)

### User stories

- **US-AUTH-1** As a visitor, I want to register with my email and a password so that I get a private account.
- **US-AUTH-2** As a user, I want to log in so that I can reach my notes.
- **US-AUTH-3** As a user, I want to stay signed in without re-entering my password for up to 7 days.
- **US-AUTH-4** As a user, I want to log out so that my session ends.

### Acceptance criteria

| ID | Criterion |
| --- | --- |
| AC-AUTH-01 | Registration SHALL accept email, password and an optional display name. **[ASSUMPTION — confirm]** (A-01) |
| AC-AUTH-02 | The email SHALL be a valid address, unique case-insensitively, and stored normalised to lower case. **[ASSUMPTION — confirm]** (A-03) |
| AC-AUTH-03 | The password SHALL be 8–128 characters with at least one letter and one digit. **[ASSUMPTION — confirm]** (A-02) |
| AC-AUTH-04 | On successful registration the user SHALL be logged in: an access token and a refresh token are returned. **[ASSUMPTION — confirm]** (A-04) |
| AC-AUTH-05 | Login with correct credentials SHALL return an access token valid for 15 minutes and a refresh token valid for 7 days. |
| AC-AUTH-06 | The refresh token SHALL be stored server-side in the database so that it can be revoked. |
| AC-AUTH-07 | Presenting a valid refresh token SHALL return a new access token and a new refresh token, and the presented refresh token SHALL be invalidated (rotation). **[ASSUMPTION — confirm]** (A-05) |
| AC-AUTH-08 | Presenting an already-used, revoked or expired refresh token SHALL be rejected. **[ASSUMPTION — confirm]** (A-05) |
| AC-AUTH-09 | Logout SHALL revoke the presented refresh token. The access token expires naturally. Other devices stay signed in. **[ASSUMPTION — confirm]** (A-06) |
| AC-AUTH-10 | Wrong email and wrong password SHALL produce the same error, so account existence is not revealed. **[ASSUMPTION — confirm]** (A-07) |
| AC-AUTH-11 | An API response SHALL never contain the password or its hash. |
| AC-AUTH-12 | Presenting a refresh token that was already rotated (replaced by a newer token, so it is reuse) SHALL be rejected and SHALL also revoke all active refresh tokens of the user it belonged to (token family revocation), so every device must log in again. An unknown, merely expired or logged-out token is rejected without revoking anything else. **[ASSUMPTION — confirm]** (A-05) |

### Error scenarios

| ID | Scenario | Expected outcome |
| --- | --- | --- |
| ERR-AUTH-01 | Register with an email that already exists | Rejected as conflict; no second account |
| ERR-AUTH-02 | Register with an invalid email or a password that breaks AC-AUTH-03 | Rejected as validation error with field messages |
| ERR-AUTH-03 | Register or login with missing fields | Rejected as validation error |
| ERR-AUTH-04 | Login with wrong email or wrong password | Rejected as unauthorised, one generic message |
| ERR-AUTH-05 | Refresh with an unknown, expired, revoked or reused token | Rejected as unauthorised |
| ERR-AUTH-06 | Logout with an unknown or already-revoked refresh token | Treated as success (idempotent), no data change **[ASSUMPTION — confirm]** (A-06) |
| ERR-AUTH-07 | Protected request with a missing, malformed or expired access token | Rejected as unauthorised |

---

## 3. Feature 2 — Auth: forgot password and OTP reset (AB-1003)

### User stories

- **US-PWD-1** As a user who forgot my password, I want to request a one-time code so that I can prove I own the account.
- **US-PWD-2** As a user, I want to set a new password using that code so that I can log in again.

### Acceptance criteria

| ID | Criterion |
| --- | --- |
| AC-PWD-01 | A forgot-password request SHALL accept an email address. |
| AC-PWD-02 | The response SHALL be identical whether or not the email belongs to an account. **[ASSUMPTION — confirm]** (A-09) |
| AC-PWD-03 | For an existing account the system SHALL generate a 6-digit numeric OTP valid for 10 minutes and usable once. **[ASSUMPTION — confirm]** (A-08) |
| AC-PWD-04 | The OTP SHALL be stored only in hashed form. |
| AC-PWD-05 | Requesting a new OTP SHALL invalidate any earlier unused OTP for that account. **[ASSUMPTION — confirm]** (A-08) |
| AC-PWD-06 | Reset SHALL accept email, OTP and a new password, and the new password SHALL follow AC-AUTH-03. |
| AC-PWD-07 | After 5 wrong OTP attempts for an account the current OTP SHALL be invalidated and a new one must be requested. **[ASSUMPTION — confirm]** (A-08) |
| AC-PWD-08 | A successful reset SHALL change the password, mark the OTP used and revoke every refresh token of that user. The user is not logged in automatically and must log in. **[ASSUMPTION — confirm]** (A-10) |
| AC-PWD-09 | The old password SHALL stop working immediately after a successful reset. |
| AC-PWD-10 | No email is sent. The OTP and its email address SHALL be written to the server console only, as a development stand-in for email. **[ASSUMPTION — confirm]** (A-11) |
| AC-PWD-11 | Only when `NODE_ENV=test`, the console email service SHALL also write each OTP to a test-only file, whose path is defined in the SDS, so that E2E tests can read it. This mechanism SHALL NOT exist or be activatable in any other environment, and the console log behaviour of AC-PWD-10 SHALL stay unchanged. |

### Error scenarios

| ID | Scenario | Expected outcome |
| --- | --- | --- |
| ERR-PWD-01 | Forgot-password with a malformed email | Rejected as validation error |
| ERR-PWD-02 | Reset with a wrong OTP | Rejected; attempt counted (AC-PWD-07) |
| ERR-PWD-03 | Reset with an expired OTP | Rejected as invalid or expired |
| ERR-PWD-04 | Reset with an already-used OTP | Rejected as invalid or expired |
| ERR-PWD-05 | Reset with a new password breaking AC-AUTH-03 | Rejected as validation error; OTP stays usable |
| ERR-PWD-06 | Reset for an email with no account | Same error as a wrong OTP, no account existence revealed |
| ERR-PWD-07 | Reset after 5 failed attempts | Rejected until a new OTP is requested |

---

## 4. Feature 3 — Notes CRUD and soft delete (AB-1004)

### User stories

- **US-NOTE-1** As a user, I want to create a note with a title and rich-text content.
- **US-NOTE-2** As a user, I want to open and edit my notes.
- **US-NOTE-3** As a user, I want to delete a note and still be able to recover it for 30 days.

### Acceptance criteria

| ID | Criterion |
| --- | --- |
| AC-NOTE-01 | Creating a note SHALL require a title of 1–200 characters. Content is optional (empty by default). **[ASSUMPTION — confirm]** (A-12) |
| AC-NOTE-02 | Content SHALL be stored as TipTap rich-text JSON, with a plain-text form derived from it for previews and search. Maximum content size is 500 KB. **[ASSUMPTION — confirm]** (A-12, A-13) |
| AC-NOTE-03 | A created note SHALL belong to the authenticated user and record `createdAt` and `updatedAt`. |
| AC-NOTE-04 | A user SHALL be able to read one of their own notes by ID, including its tags. |
| AC-NOTE-05 | A user SHALL be able to update a note's title and content. `updatedAt` SHALL change on every successful update. |
| AC-NOTE-06 | Deleting a note SHALL only set `deletedAt`. The row SHALL NOT be physically deleted within the 30-day recovery window. |
| AC-NOTE-07 | A soft-deleted note SHALL NOT appear in lists, search results or tag counts, SHALL NOT be readable or editable through the normal note operations, and SHALL make its share links unavailable. **[ASSUMPTION — confirm]** (A-15) |
| AC-NOTE-08 | A user SHALL be able to list their soft-deleted notes and restore one within 30 days, which clears `deletedAt`. **[ASSUMPTION — confirm]** (A-14) |
| AC-NOTE-09 | Notes soft-deleted for more than 30 days MAY be physically removed by an automatic purge. Nothing newer SHALL be removed. **[ASSUMPTION — confirm]** (A-14) |
| AC-NOTE-10 | Deleting an already soft-deleted note SHALL NOT change its `deletedAt`. |

### Error scenarios

| ID | Scenario | Expected outcome |
| --- | --- | --- |
| ERR-NOTE-01 | Create or update with an empty or over-long title, or content over the size limit | Rejected as validation error |
| ERR-NOTE-02 | Read, update or delete a note that does not exist | Rejected as not found |
| ERR-NOTE-03 | Read, update or delete another user's note | Rejected as not found (FR-X-1) |
| ERR-NOTE-04 | Read or update a soft-deleted note through normal operations | Rejected as not found |
| ERR-NOTE-05 | Restore a note that is not deleted, or whose 30 days have passed | Rejected as not found |
| ERR-NOTE-06 | Any note operation without a valid access token | Rejected as unauthorised |
| ERR-NOTE-07 | A malformed note ID | Rejected as validation error |

---

## 5. Feature 4 — Notes list: pagination, sorting, tag filter (AB-1005)

### User stories

- **US-LIST-1** As a user, I want my notes listed in pages so that large collections stay fast.
- **US-LIST-2** As a user, I want to sort notes so that I can find recent or alphabetical ones.
- **US-LIST-3** As a user, I want to filter notes by tag so that I can see one topic.

### Acceptance criteria

| ID | Criterion |
| --- | --- |
| AC-LIST-01 | The list SHALL return only the caller's non-deleted notes. |
| AC-LIST-02 | Pagination SHALL use page and page size. Default page size is 20, maximum 100. The response SHALL include the total number of matching notes and the total number of pages. **[ASSUMPTION — confirm]** (A-16) |
| AC-LIST-03 | Sorting SHALL support `updatedAt`, `createdAt` and `title`, ascending or descending. The default is `updatedAt` descending. **[ASSUMPTION — confirm]** (A-17) |
| AC-LIST-04 | Sorting SHALL be deterministic: ties are broken by note ID. |
| AC-LIST-05 | The list SHALL be filterable by one or more tags. With several tags, a note SHALL match if it has at least one of them (OR), and SHALL appear only once even if it has several of the selected tags. **[ASSUMPTION — confirm]** (A-18) |
| AC-LIST-06 | Each list item SHALL include its ID, title, a short plain-text preview, its tags and its timestamps. |
| AC-LIST-07 | A page beyond the last SHALL return an empty list with correct totals, not an error. |
| AC-LIST-08 | Filtering by a tag the caller does not own SHALL be rejected, so no other user's tag is revealed. |

### Error scenarios

| ID | Scenario | Expected outcome |
| --- | --- | --- |
| ERR-LIST-01 | Page below 1, page size below 1 or above 100, or non-numeric | Rejected as validation error |
| ERR-LIST-02 | Unknown sort field or direction | Rejected as validation error |
| ERR-LIST-03 | Tag filter with a malformed tag ID | Rejected as validation error |
| ERR-LIST-04 | Tag filter with a tag that does not exist or belongs to another user | Rejected as not found |
| ERR-LIST-05 | List without a valid access token | Rejected as unauthorised |

---

## 6. Feature 5 — Tags: CRUD and note counts (AB-1006)

### User stories

- **US-TAG-1** As a user, I want to create coloured tags so that I can organise notes.
- **US-TAG-2** As a user, I want to attach and detach tags on a note.
- **US-TAG-3** As a user, I want to see how many notes each tag has.

### Acceptance criteria

| ID | Criterion |
| --- | --- |
| AC-TAG-01 | Tags SHALL be scoped to the user. Two users may use the same tag name. |
| AC-TAG-02 | A tag name SHALL be 1–30 characters and unique per user, case-insensitively. **[ASSUMPTION — confirm]** (A-19) |
| AC-TAG-03 | A tag SHALL have a colour as `#RRGGBB`. If none is given, a default grey (`#6B7280`) is used. **[ASSUMPTION — confirm]** (A-19) |
| AC-TAG-04 | A user SHALL be able to create, list, rename, recolour and delete their own tags. |
| AC-TAG-05 | Listing tags SHALL return each tag with its note count. |
| AC-TAG-06 | The note count SHALL count only the caller's non-deleted notes. **[ASSUMPTION — confirm]** (A-21) |
| AC-TAG-07 | A user SHALL be able to set the tags on a note by tag ID. A note SHALL have at most 10 tags. **[ASSUMPTION — confirm]** (A-20) |
| AC-TAG-08 | Deleting a tag SHALL detach it from all notes and SHALL NOT delete or modify any note content. **[ASSUMPTION — confirm]** (A-21) |
| AC-TAG-09 | Renaming or recolouring a tag SHALL be visible on all notes that use it. |

### Error scenarios

| ID | Scenario | Expected outcome |
| --- | --- | --- |
| ERR-TAG-01 | Create or rename to a name that already exists for this user (any letter case) | Rejected as conflict |
| ERR-TAG-02 | Empty or over-long name, or a colour that is not `#RRGGBB` | Rejected as validation error |
| ERR-TAG-03 | Update or delete a tag that does not exist or belongs to another user | Rejected as not found |
| ERR-TAG-04 | Attach a tag the caller does not own, or one that does not exist | Rejected as not found; the note is unchanged |
| ERR-TAG-05 | Attach more than 10 tags to one note | Rejected as validation error |
| ERR-TAG-06 | Attach tags to a note that is missing, another user's, or soft-deleted | Rejected as not found |
| ERR-TAG-07 | Any tag operation without a valid access token | Rejected as unauthorised |

---

## 7. Feature 6 — Full-text search with highlight (AB-1007)

### User stories

- **US-SRCH-1** As a user, I want to search my notes by keyword so that I can find them quickly.
- **US-SRCH-2** As a user, I want the matching words highlighted so that I can see why a note matched.

### Acceptance criteria

| ID | Criterion |
| --- | --- |
| AC-SRCH-01 | Search SHALL use PostgreSQL Full-Text Search only. No external search service. |
| AC-SRCH-02 | Search SHALL cover note title and content text. **[ASSUMPTION — confirm]** (A-22) |
| AC-SRCH-03 | Results SHALL be limited to the caller's non-deleted notes. |
| AC-SRCH-04 | Results SHALL be ordered by relevance, with title matches ranking above content matches. Ties are broken by `updatedAt` descending. **[ASSUMPTION — confirm]** (A-22) |
| AC-SRCH-05 | Each result SHALL include a snippet of the matching text with every matched keyword wrapped in `<mark>` tags. **[ASSUMPTION — confirm]** (A-22) |
| AC-SRCH-06 | Snippets SHALL be HTML-escaped except for the `<mark>` tags, so note content can never inject markup. |
| AC-SRCH-07 | Search SHALL be paginated with the same rules as AC-LIST-02. |
| AC-SRCH-08 | The query SHALL be at least 2 characters after trimming. **[ASSUMPTION — confirm]** (A-22) |
| AC-SRCH-09 | A query with no matches SHALL return an empty result list, not an error. |
| AC-SRCH-10 | Query text SHALL be treated as plain words. It SHALL NOT be able to trigger a database error or operator injection. |
| AC-SRCH-11 | A note changed or created SHALL be searchable on its next search, with no manual re-indexing. |

### Error scenarios

| ID | Scenario | Expected outcome |
| --- | --- | --- |
| ERR-SRCH-01 | Missing, empty or 1-character query | Rejected as validation error |
| ERR-SRCH-02 | Invalid pagination values | Rejected as validation error |
| ERR-SRCH-03 | Query with special characters or search-operator syntax (for example `&`, `!`, parentheses, `:`) | Handled safely as plain text; never a server error |
| ERR-SRCH-04 | Search without a valid access token | Rejected as unauthorised |
| ERR-SRCH-05 | A term matching only another user's or a soft-deleted note | No result returned |

---

## 8. Feature 7 — Sharing: public links (AB-1008)

### User stories

- **US-SHARE-1** As a user, I want to generate a public read-only link to a note so that someone without an account can read it.
- **US-SHARE-2** As a user, I want a link to expire or be revoked so that I control access.
- **US-SHARE-3** As a user, I want to see how many times my link was viewed.

### Acceptance criteria

| ID | Criterion |
| --- | --- |
| AC-SHARE-01 | A user SHALL be able to generate a share link for their own non-deleted note. |
| AC-SHARE-02 | A note MAY have several active links at the same time. Each link SHALL have its own token, expiry, revoke state and view count. Revoking or expiring one link SHALL NOT affect the others. **[ASSUMPTION — confirm]** (A-23) |
| AC-SHARE-03 | The link token SHALL be unguessable (at least 128 bits of randomness). |
| AC-SHARE-04 | Expiry SHALL be optional. When given, it SHALL be a future date and at most 365 days away. With no expiry the link lasts until revoked. **[ASSUMPTION — confirm]** (A-24) |
| AC-SHARE-05 | Anyone with a valid link SHALL read the note without logging in, read-only. |
| AC-SHARE-06 | The public view SHALL expose only the note title, content and last-updated time. It SHALL NOT expose the owner, tags, version history or other notes. **[ASSUMPTION — confirm]** (A-25) |
| AC-SHARE-07 | Each successful public view SHALL increase the view count by exactly 1, atomically. Under concurrent views no count SHALL be lost. |
| AC-SHARE-08 | Views by the owner through the authenticated API SHALL NOT count. Failed or rejected public requests SHALL NOT count. **[ASSUMPTION — confirm]** (A-27) |
| AC-SHARE-09 | The owner SHALL see for each link its creation time, expiry, view count and status (active, expired or revoked). |
| AC-SHARE-10 | The owner SHALL be able to revoke a link. A revoked link SHALL stop working immediately and permanently. |
| AC-SHARE-11 | The owner SHALL be able to list all links of one note, and list their active links across all their notes. **[ASSUMPTION — confirm]** (A-23) |
| AC-SHARE-12 | An expired link SHALL stop working at its expiry time without any manual action. |
| AC-SHARE-13 | A link to a soft-deleted note SHALL be unavailable. If the note is restored within the window and the link was not revoked or expired, it works again. **[ASSUMPTION — confirm]** (A-15) |
| AC-SHARE-14 | The public viewer SHALL NOT be able to tell an unknown, revoked, expired or deleted-note link apart. **[ASSUMPTION — confirm]** (A-26) |

### Error scenarios

| ID | Scenario | Expected outcome |
| --- | --- | --- |
| ERR-SHARE-01 | Generate for a note that is missing, another user's or soft-deleted | Rejected as not found |
| ERR-SHARE-02 | Expiry in the past, not a valid date, or more than 365 days away | Rejected as validation error |
| ERR-SHARE-03 | Revoke a link that is missing or another user's | Rejected as not found |
| ERR-SHARE-04 | Revoke a link that is already revoked | Treated as success (idempotent) |
| ERR-SHARE-05 | Public access with an unknown token | Rejected as not found; no view counted |
| ERR-SHARE-06 | Public access with a revoked or expired link | Rejected, indistinguishable from unknown; no view counted |
| ERR-SHARE-07 | Public access to a link of a soft-deleted note | Rejected, indistinguishable from unknown; no view counted |
| ERR-SHARE-08 | Owner operations without a valid access token | Rejected as unauthorised |
| ERR-SHARE-09 | Public access is attempted with an access token as well | The token is ignored; same behaviour as anonymous |

---

## 9. Feature 8 — Version history (AB-1009)

### User stories

- **US-VER-1** As a user, I want every save of a note kept as a version so that I can look back.
- **US-VER-2** As a user, I want to view an old version and restore it without losing the newer history.

### Acceptance criteria

| ID | Criterion |
| --- | --- |
| AC-VER-01 | Creating a note SHALL create version 1. Each later save that changes the title or content SHALL create the next version. **[ASSUMPTION — confirm]** (A-28) |
| AC-VER-02 | A save whose title and content are identical to the latest version SHALL NOT create a new version (this stops autosave from creating duplicates). **[ASSUMPTION — confirm]** (A-28) |
| AC-VER-03 | A version SHALL record the title, content, version number and creation time. Versions SHALL be immutable. Tags are not versioned. **[ASSUMPTION — confirm]** (A-28) |
| AC-VER-04 | Version numbers SHALL be sequential per note and never reused, even after purging. |
| AC-VER-05 | A user SHALL be able to list the versions of their own note, newest first, paginated. |
| AC-VER-06 | A user SHALL be able to view the full content of any retained version, read-only. |
| AC-VER-07 | Restoring version N SHALL create a new version (N+k) with the title and content of version N, and SHALL update the note to match. Existing versions SHALL NOT be changed or removed by a restore. |
| AC-VER-08 | Automatic purge SHALL keep only the 50 newest versions per note. No version is removed because of its age. The latest version SHALL never be purged. **[ASSUMPTION — confirm]** (A-29) |
| AC-VER-09 | The note's current state SHALL always equal its latest version. |
| AC-VER-10 | Versions of a soft-deleted note SHALL not be accessible, but SHALL be kept while the note is kept. **[ASSUMPTION — confirm]** (A-31) |
| AC-VER-11 | Snapshot creation and the note update SHALL succeed or fail together, so the history never disagrees with the note. |

### Error scenarios

| ID | Scenario | Expected outcome |
| --- | --- | --- |
| ERR-VER-01 | List, view or restore for a note that is missing, another user's or soft-deleted | Rejected as not found |
| ERR-VER-02 | View or restore a version number that does not exist or was purged | Rejected as not found |
| ERR-VER-03 | Restore the version that is already the latest | Rejected as conflict, no new version **[ASSUMPTION — confirm]** (A-30) |
| ERR-VER-04 | Malformed version number or invalid pagination values | Rejected as validation error |
| ERR-VER-05 | Version operations without a valid access token | Rejected as unauthorised |
| ERR-VER-06 | A restore that fails part-way | No new version and no change to the note (AC-VER-11) |

---

## 10. Frontend requirements (AB-1010 to AB-1015)

Frontend work SHALL consume the shared types and Zod schemas from `packages/shared` and SHALL NOT redefine them. UI language is English only. **[ASSUMPTION — confirm]** (A-40)

### 10.1 Auth pages (AB-1010)

| ID | Criterion |
| --- | --- |
| AC-FEAUTH-01 | Pages SHALL exist for register, login, forgot password and reset password. |
| AC-FEAUTH-02 | Forms SHALL validate with the shared Zod schemas before sending, and show field-level errors from the server. |
| AC-FEAUTH-03 | Submit buttons SHALL be disabled with a loading state while a request is in flight, to prevent double submit. |
| AC-FEAUTH-04 | After login or registration the user SHALL be taken to the notes list. |
| AC-FEAUTH-05 | The session SHALL survive a page reload and expired access tokens SHALL be renewed silently using the refresh token, for up to 7 days. If renewal fails the user SHALL be sent to login. **[ASSUMPTION — confirm]** (A-32) |
| AC-FEAUTH-06 | Logout SHALL end the session and return to login. |
| AC-FEAUTH-07 | Unauthenticated visitors to protected pages SHALL be redirected to login. Logged-in users visiting login or register SHALL be sent to the notes list. |
| AC-FEAUTH-08 | The forgot-password flow SHALL guide the user from requesting a code to entering the code and a new password, then to login. |

Errors: wrong credentials show the generic message; network failure shows a retry message and keeps the entered data.

### 10.2 Notes list page (AB-1011)

| ID | Criterion |
| --- | --- |
| AC-FELIST-01 | The page SHALL show the user's notes with title, preview, tags and last-updated date. **[ASSUMPTION — confirm]** (A-38) |
| AC-FELIST-02 | The user SHALL be able to page through notes, choose a sort field and direction, and filter by one or more tags (a note matches if it has any of them). |
| AC-FELIST-03 | Page, sort and tag filter SHALL be reflected in the URL so that a reload or shared URL restores the view. |
| AC-FELIST-04 | A "new note" action SHALL create a note and open the editor. |
| AC-FELIST-05 | Deleting a note SHALL require confirmation and SHALL tell the user the note can be restored from Trash for 30 days. **[ASSUMPTION — confirm]** (A-36) |
| AC-FELIST-06 | The page SHALL show distinct loading, empty and error states, with a retry action on error. |
| AC-FELIST-07 | The user SHALL be able to create, rename, recolour and delete tags, and see each tag's note count. |
| AC-FELIST-08 | A Trash view reachable from the notes list page SHALL list the user's soft-deleted notes that are still inside the 30-day recovery window, showing title, deletion date and days remaining. Trashed notes SHALL NOT appear in the normal list. **[ASSUMPTION — confirm]** (A-14) |
| AC-FELIST-09 | Each trashed note SHALL have a Restore action that returns it to the normal list with its content, tags and versions intact. The Trash view SHALL show loading, empty and error states. If a restore fails because the 30 days have passed, a clear message SHALL be shown. **[ASSUMPTION — confirm]** (A-14) |

### 10.3 Note editor with TipTap and autosave (AB-1012)

| ID | Criterion |
| --- | --- |
| AC-FEEDIT-01 | The editor SHALL use TipTap and support headings (levels 1–3), bold, italic, strike-through, bullet and numbered lists, block quote, inline and block code, links, and undo/redo. **[ASSUMPTION — confirm]** (A-34) |
| AC-FEEDIT-02 | The user SHALL be able to edit the title and assign or remove tags. |
| AC-FEEDIT-03 | Changes SHALL autosave 2 seconds after the last edit, with no save button needed. **[ASSUMPTION — confirm]** (A-33) |
| AC-FEEDIT-04 | A save status SHALL be shown at all times: Saving, Saved, or Failed with a retry. |
| AC-FEEDIT-05 | If the autosave fails, the user's edits SHALL stay in the editor and be retried; they SHALL NOT be lost. |
| AC-FEEDIT-06 | Leaving the page with unsaved changes SHALL either save them or warn the user. |
| AC-FEEDIT-07 | Opening a missing, deleted or other user's note SHALL show a not-found state. |
| AC-FEEDIT-08 | Pasted or typed content SHALL never execute scripts. |
| AC-FEEDIT-09 | Actions to open share and version history SHALL be available from the editor. |

### 10.4 Search UI with highlights (AB-1013)

| ID | Criterion |
| --- | --- |
| AC-FESRCH-01 | A search box SHALL be available on the notes list page. |
| AC-FESRCH-02 | Searching SHALL start 300 ms after the user stops typing, and only when the query is at least 2 characters. **[ASSUMPTION — confirm]** (A-35) |
| AC-FESRCH-03 | Results SHALL show the title and a snippet with the matched keywords visibly highlighted. |
| AC-FESRCH-04 | Snippets SHALL be rendered safely: only the `<mark>` highlight is honoured, and nothing else from note content is treated as markup. |
| AC-FESRCH-05 | Results SHALL be paginated, with loading, no-results and error states. |
| AC-FESRCH-06 | Clearing the search SHALL return to the normal notes list. |
| AC-FESRCH-07 | Choosing a result SHALL open that note in the editor. |

### 10.5 Share modal and active links (AB-1014)

| ID | Criterion |
| --- | --- |
| AC-FESHARE-01 | The share modal SHALL let the owner create one or more links for the note, each with its own optional expiry. |
| AC-FESHARE-02 | The modal SHALL show each link, with a copy-to-clipboard action and confirmation. |
| AC-FESHARE-03 | The modal SHALL list every link of the note with its status, expiry and view count. |
| AC-FESHARE-04 | The owner SHALL be able to revoke any single link, after confirmation, without affecting the note's other links. |
| AC-FESHARE-05 | A page listing all the user's active links SHALL show note title, expiry, view count and a revoke action. **[ASSUMPTION — confirm]** (A-23) |
| AC-FESHARE-06 | A public page SHALL render a shared note read-only without login, and show a clear unavailable state for any invalid link. |
| AC-FESHARE-07 | The public page SHALL show no editing controls and no owner data. |

### 10.6 Version history drawer and restore (AB-1015)

| ID | Criterion |
| --- | --- |
| AC-FEVER-01 | A drawer opened from the editor SHALL list the versions, newest first, with version number and time. |
| AC-FEVER-02 | Selecting a version SHALL show its title and content read-only. |
| AC-FEVER-03 | The user SHALL be able to restore a selected version after confirmation. |
| AC-FEVER-04 | After restore, the editor SHALL show the restored content and the drawer SHALL list the new version at the top. |
| AC-FEVER-05 | Restoring the latest version SHALL be blocked in the UI with an explanation. |
| AC-FEVER-06 | The drawer SHALL show loading, empty and error states, and paginate or lazy-load long lists. |
| AC-FEVER-07 | Pending autosave changes SHALL be flushed before restore, to avoid restoring over unsaved edits. |

---

## 11. End-to-end journey (AB-1016)

| ID | Criterion |
| --- | --- |
| AC-E2E-01 | A Playwright test SHALL run the full journey in a real browser against the running frontend, backend and database: register → logout → login → create note → edit with autosave → add tag → filter by tag → search with highlight → share → open the public link in a logged-out context → revoke → public link now unavailable → edit again → open version history → restore → delete the note → restore it from Trash → logout. |
| AC-E2E-02 | A second test SHALL cover forgot password and reset, taking the OTP from the test-only OTP file defined in AC-PWD-11, not from console output. **[ASSUMPTION — confirm]** (A-37) |
| AC-E2E-03 | A third test SHALL cover a key error path: an invalid login and a revoked public link. |
| AC-E2E-04 | Each test SHALL start from a clean database state and SHALL NOT depend on another test. **[ASSUMPTION — confirm]** (A-37) |
| AC-E2E-05 | The suite SHALL pass in the latest Chromium. Other browsers are not required. **[ASSUMPTION — confirm]** (A-37) |

### Project setup (AB-1001)

| ID | Criterion |
| --- | --- |
| AC-SETUP-01 | A pnpm workspace monorepo SHALL exist with `backend`, `frontend` and `packages/shared`. |
| AC-SETUP-02 | Prisma SHALL be configured against PostgreSQL 16. |
| AC-SETUP-03 | All tool and dependency versions SHALL be pinned exactly; `@latest` SHALL NOT be used (Rule 20). |
| AC-SETUP-04 | `CLAUDE.md` and `AGENTS.md` SHALL exist at root, with layer `CLAUDE.md` files for `backend`, `frontend` and `packages/shared`. |
| AC-SETUP-05 | Agents, skills, custom commands and MCP configuration SHALL be committed, with no secrets. |
| AC-SETUP-06 | Husky pre-commit and commitlint SHALL block failing builds, lint, tests and non-conventional commits (Rules 13 and 14). |
| AC-SETUP-07 | `pnpm build`, `pnpm lint --max-warnings 0` and `pnpm test` SHALL run from the root and pass on a fresh clone. |

---

## 12. Assumptions to confirm

Every item below is a choice made by the FRS author because the assignment does not specify it. Please confirm or change each one.

| ID | Assumption | Where used |
| --- | --- | --- |
| A-01 | Registration takes email, password and an optional display name. | AC-AUTH-01 |
| A-02 | Password: 8–128 characters, at least one letter and one digit. | AC-AUTH-03 |
| A-03 | Email is unique case-insensitively and stored in lower case. | AC-AUTH-02 |
| A-04 | Successful registration logs the user in (returns tokens). | AC-AUTH-04 |
| A-05 | Refresh tokens rotate on each use. Reuse of a rotated token is rejected and revokes all active refresh tokens of that user (family revocation). A logged-out token is rejected without revoking other sessions. | AC-AUTH-07, 08, 12 |
| A-06 | Logout revokes only the presented refresh token (this device). Logout is idempotent. | AC-AUTH-09, ERR-AUTH-06 |
| A-07 | Wrong email and wrong password give the same generic error. | AC-AUTH-10 |
| A-08 | OTP is 6 digits, valid 10 minutes, single use, max 5 wrong attempts, and a new request invalidates the old OTP. | AC-PWD-03, 05, 07 |
| A-09 | Forgot-password gives an identical response whether or not the account exists. | AC-PWD-02 |
| A-10 | A successful reset revokes all refresh tokens and does not log the user in. | AC-PWD-08 |
| A-11 | The OTP "email" is a console log line only, for development. | AC-PWD-10 |
| A-12 | Note title 1–200 characters. Content optional, maximum 500 KB. | AC-NOTE-01, 02 |
| A-13 | Content is stored as TipTap JSON, with a derived plain-text form for previews and search. | AC-NOTE-02 |
| A-14 | Soft-deleted notes are recoverable by the user for 30 days: trash list and restore in the API, plus a Trash view with Restore on the notes list page. A purge job removes notes deleted over 30 days ago. | AC-NOTE-08, 09, AC-FELIST-08, 09 |
| A-15 | A soft-deleted note is not found by normal operations. Its share links are unavailable but work again if the note is restored. | AC-NOTE-07, AC-SHARE-13 |
| A-16 | Pagination by page and page size. Default size 20, maximum 100. Totals included. | AC-LIST-02, AC-SRCH-07 |
| A-17 | Sort fields: `updatedAt`, `createdAt`, `title`. Default `updatedAt` descending. | AC-LIST-03 |
| A-18 | Filtering by several tags returns notes that have any of them (OR), each note once. | AC-LIST-05, AC-FELIST-02 |
| A-19 | Tag name 1–30 characters, unique per user ignoring case. Colour `#RRGGBB`, default `#6B7280`. | AC-TAG-02, 03 |
| A-20 | Maximum 10 tags per note. | AC-TAG-07 |
| A-21 | Deleting a tag only detaches it. Tag counts ignore soft-deleted notes. | AC-TAG-06, 08 |
| A-22 | Search covers title and content, ranks title above content, uses `<mark>` highlight, needs 2 or more characters, and does not combine with the tag filter. | AC-SRCH-02, 04, 05, 08 |
| A-23 | A note can have several active share links, each with its own expiry, revoke state and view count. The user can list links per note and all active links. | AC-SHARE-02, 11, AC-FESHARE-01 to 05 |
| A-24 | Link expiry is optional, in the future, at most 365 days out. | AC-SHARE-04 |
| A-25 | The public view shows only title, content and last-updated time. | AC-SHARE-06 |
| A-26 | Unknown, revoked, expired and deleted-note links look identical to the public. | AC-SHARE-14 |
| A-27 | Every successful public view counts, with no unique-visitor logic. Owner views do not count. | AC-SHARE-08 |
| A-28 | A version snapshots title and content only (not tags). A save identical to the latest version creates no version. | AC-VER-01 to 03 |
| A-29 | Version purge keeps only the newest 50 versions per note, never the latest. No age-based rule. | AC-VER-08 |
| A-30 | Restoring the version that is already latest is rejected as a conflict. | ERR-VER-03, AC-FEVER-05 |
| A-31 | Versions of a soft-deleted note are inaccessible but kept with the note. | AC-VER-10 |
| A-32 | The session survives reload and refreshes silently for up to 7 days. Where the tokens are stored is decided in the SDS. | AC-FEAUTH-05 |
| A-33 | Autosave fires 2 seconds after the last edit. | AC-FEEDIT-03 |
| A-34 | Editor formatting set: H1–H3, bold, italic, strike, bullet and numbered lists, block quote, code, links, undo/redo. | AC-FEEDIT-01 |
| A-35 | Search input debounce 300 ms. | AC-FESRCH-02 |
| A-36 | Destructive actions (delete note, revoke link, restore version) ask for confirmation. | AC-FELIST-05, AC-FESHARE-04, AC-FEVER-03 |
| A-37 | E2E: clean database per test, Chromium only, OTP read from the test-only OTP file (AC-PWD-11), not from console output. | AC-E2E-02, 04, 05 |
| A-38 | List items show title, a short plain-text preview (about 150 characters), tags and updated date. | AC-FELIST-01 |
| A-39 | Concurrent saves: last write wins, no conflict detection. | FR-X-6 |
| A-40 | English-only UI, no internationalisation. | Section 10 |

---

## 13. Out of scope

The assignment forbids these. Any attempt is a violation.

- Real-time collaborative editing
- File or image attachments
- Mobile app
- OAuth or social login
- Note folders or nesting
- Actual email sending (the OTP is logged to the console only)

Also out of scope for this FRS, because no ticket asks for them. **[ASSUMPTION — confirm]**

- Combining search with the tag filter (A-22)
- Login throttling or account lockout (not in the assignment; only the OTP attempt limit in AC-PWD-07 applies)
- Admin roles, user profile editing and account deletion
- Notifications, exports and imports
- Unique-visitor analytics on share links (A-27)
- Internationalisation (A-40)

---

## 14. Traceability matrix

Each ticket to the FRS requirements it must deliver. Every acceptance criterion and error scenario of a feature is in scope of its ticket.

| Ticket | Title | Feature | Requirements | Error scenarios |
| --- | --- | --- | --- | --- |
| AB-1001 | Project setup | Infrastructure | AC-SETUP-01 to 07, FR-X-1 to FR-X-6 (foundations) | none |
| AB-1002 | Auth: register, login, logout, JWT + refresh | Feature 1 | US-AUTH-1 to 4, AC-AUTH-01 to 12 | ERR-AUTH-01 to 07 |
| AB-1003 | Auth: forgot password + OTP reset | Feature 2 | US-PWD-1 to 2, AC-PWD-01 to 11 | ERR-PWD-01 to 07 |
| AB-1004 | Notes: CRUD + soft delete | Feature 3 | US-NOTE-1 to 3, AC-NOTE-01 to 10 | ERR-NOTE-01 to 07 |
| AB-1005 | Notes: pagination, sorting, tag filtering | Feature 4 | US-LIST-1 to 3, AC-LIST-01 to 08 | ERR-LIST-01 to 05 |
| AB-1006 | Tags: CRUD + note count | Feature 5 | US-TAG-1 to 3, AC-TAG-01 to 09 | ERR-TAG-01 to 07 |
| AB-1007 | Search: full-text with highlight + pagination | Feature 6 | US-SRCH-1 to 2, AC-SRCH-01 to 11 | ERR-SRCH-01 to 05 |
| AB-1008 | Sharing: link, revoke, public access, atomic view count | Feature 7 | US-SHARE-1 to 3, AC-SHARE-01 to 14 | ERR-SHARE-01 to 09 |
| AB-1009 | Version history: snapshot, list, view, restore, auto-purge | Feature 8 | US-VER-1 to 2, AC-VER-01 to 11 | ERR-VER-01 to 06 |
| AB-1010 | Frontend: Auth pages | Section 10.1 | AC-FEAUTH-01 to 08 (uses Features 1 and 2) | Auth error scenarios shown in UI |
| AB-1011 | Frontend: Notes list page, tags and Trash view | Section 10.2 | AC-FELIST-01 to 09 (uses Features 3, 4, 5) | List and tag error scenarios, and ERR-NOTE-05 (expired restore), shown in UI |
| AB-1012 | Frontend: Note editor, TipTap, autosave | Section 10.3 | AC-FEEDIT-01 to 09 (uses Features 3, 5, 8) | ERR-NOTE-02 to 04, autosave failure |
| AB-1013 | Frontend: Search UI with highlights | Section 10.4 | AC-FESRCH-01 to 07 (uses Feature 6) | ERR-SRCH-01 to 05 shown in UI |
| AB-1014 | Frontend: Share modal + active links | Section 10.5 | AC-FESHARE-01 to 07 (uses Feature 7) | ERR-SHARE-01 to 09 shown in UI |
| AB-1015 | Frontend: Version history drawer + restore | Section 10.6 | AC-FEVER-01 to 07 (uses Feature 8) | ERR-VER-01 to 06 shown in UI |
| AB-1016 | E2E: Playwright full user journey | Section 11 | AC-E2E-01 to 05 (AC-E2E-02 reads the OTP file from AC-PWD-11, delivered in AB-1003) | Journeys across all features |

### Coverage check (feature to ticket)

| Assignment feature | Tickets |
| --- | --- |
| 1. Auth | AB-1002, AB-1003, AB-1010 |
| 2. Notes CRUD | AB-1004, AB-1005, AB-1011, AB-1012 |
| 3. Tags | AB-1006, AB-1011, AB-1012 |
| 4. Search | AB-1007, AB-1013 |
| 5. Sharing | AB-1008, AB-1014 |
| 6. Version history | AB-1009, AB-1015 |
| All | AB-1001 (foundation), AB-1016 (E2E) |
