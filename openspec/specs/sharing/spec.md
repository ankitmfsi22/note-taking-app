# sharing Specification

## Purpose
Let an owner publish read-only links to their notes, revoke or expire them, and see an exact view count.

## Requirements

### Requirement: Create share link (AC-SHARE-01 to 04, ERR-SHARE-01, ERR-SHARE-02)
`POST /api/v1/notes/:noteId/shares` SHALL create a link for the caller's non-deleted note and return `201 ShareLinkResponse` with a 43-character base64url token from `crypto.randomBytes(32)`. A note SHALL allow several independent links. `expiresAt` SHALL be optional, future and at most 365 days ahead by the injected `Clock`, else `400 VALIDATION_ERROR` **[ASSUMPTION — confirm]** (Recommended: exactly 365 days is accepted; the service checks the range).

#### Scenario: S-AB1008-01 create two links for one note returns 201 with distinct unguessable tokens
- **WHEN** an owner posts `{}` and then `{ "expiresAt": <Clock now + 7 days> }` to `POST /notes/:noteId/shares` for their own note
- **THEN** both responses are `201` with `status` `active`, `viewCount` `0`, `revokedAt` `null` and a `token` matching `/^[A-Za-z0-9_-]{43}$/`; the tokens differ, the first has `expiresAt` `null`, and two `ShareLink` rows exist for the note

### Requirement: Public read with atomic view count (AC-SHARE-05 to 08, ERR-SHARE-09)
`GET /api/v1/public/shares/:token` SHALL need no login, ignore any `Authorization` header, and return `200 PublicSharedNote` with only `title`, `content` and `updatedAt`. It SHALL run one `UPDATE ... RETURNING` (SDS 8.3) so each successful view adds exactly 1 and no concurrent view is lost. Owner reads through the authenticated API SHALL NOT count. It SHALL send `Cache-Control: no-store` and `X-Robots-Tag: noindex`.

#### Scenario: S-AB1008-02 public view returns the note read-only and counts 50 concurrent views exactly
- **WHEN** an active link exists, the owner calls `GET /notes/:noteId` once, and 50 anonymous `GET /public/shares/:token` requests run in parallel against the real test database, one of them with another user's `Authorization: Bearer` header
- **THEN** every public response is `200` with exactly the keys `title`, `content`, `updatedAt` and the headers `Cache-Control: no-store` and `X-Robots-Tag: noindex`, and the link's `viewCount` is exactly `50`

### Requirement: Revoke and list links (AC-SHARE-02, AC-SHARE-09 to 11, ERR-SHARE-04)
`POST /api/v1/shares/:shareId/revoke` SHALL set `revokedAt` only when it is null and return `200 ShareLinkResponse`; revoking again SHALL succeed and change nothing. Other links of the note SHALL be untouched. `GET /notes/:noteId/shares` SHALL list all links of the note with `createdAt`, `expiresAt`, `viewCount` and `status` from the injected `Clock`. `GET /shares` SHALL list paginated active links of all the caller's notes with `noteTitle`.

#### Scenario: S-AB1008-03 revoke is idempotent, leaves other links working and is reflected in the lists
- **WHEN** a note has links A and B, the owner posts `POST /shares/:shareId/revoke` for A twice, then calls `GET /notes/:noteId/shares`, `GET /shares` and `GET /public/shares/<token of B>`
- **THEN** both revoke responses are `200` with `status` `revoked` and the same `revokedAt`; the per-note list has A `revoked` and B `active`; `GET /shares` returns only B with its `noteTitle`, `page` `1`, `total` `1`; and B's public view is `200`

### Requirement: Unavailable links are indistinguishable (AC-SHARE-10, AC-SHARE-12 to 14, ERR-SHARE-05 to 07)
A public read of an unknown, revoked, expired or soft-deleted-note link SHALL return `404 SHARE_LINK_NOT_FOUND` with the same message and change no `viewCount`. Expiry SHALL use the database clock, with no job. A restored note's link that is not revoked or expired SHALL work again. **[ASSUMPTION — confirm]** (Recommended: the expired case is tested with a stored `expiresAt` before database `now()`, per SA-18).

#### Scenario: S-AB1008-04 unknown, revoked, expired and deleted-note links return the same 404 and count nothing
- **WHEN** an anonymous visitor calls `GET /public/shares/:token` with an unknown well-formed token, a revoked link, a link with `expiresAt` before the database `now()`, and a link of a soft-deleted note, then the owner restores that note and the visitor retries its link
- **THEN** the four responses are `404` with `error.code` `SHARE_LINK_NOT_FOUND` and bodies that are equal except `requestId`, no `viewCount` changed, and after the restore the link returns `200` and its `viewCount` is `1`

### Requirement: Owner endpoints need authentication and ownership (ERR-SHARE-01, ERR-SHARE-03, ERR-SHARE-08)
The four owner endpoints SHALL require a valid access token, else `401 UNAUTHORIZED`. Creating a link for a missing, soft-deleted or another user's note SHALL return `404 NOTE_NOT_FOUND`. Revoking a missing or another user's link SHALL return `404 SHARE_LINK_NOT_FOUND`. Every query SHALL filter by the caller's `userId` through the note; `403` SHALL NOT be used.

#### Scenario: S-AB1008-05 another user's note or link returns 404 and a missing token returns 401
- **WHEN** user B calls `POST /notes/:noteId/shares` and `GET /notes/:noteId/shares` for user A's note, `POST /shares/:shareId/revoke` for A's link, and A calls `POST /notes/:noteId/shares` for their own soft-deleted note; then a client calls each owner endpoint without `Authorization`
- **THEN** B's note calls and A's deleted-note call return `404` `NOTE_NOT_FOUND`, B's revoke returns `404` `SHARE_LINK_NOT_FOUND` and A's link keeps `revokedAt` `null`, no link is created, and every call without a token returns `401` `UNAUTHORIZED`

### Requirement: Input validation (ERR-SHARE-02)
Bodies and parameters SHALL be validated with the shared Zod schemas. A failure SHALL return `400 VALIDATION_ERROR` with field-level `details` and SHALL NOT write anything. A public `:token` that is not 43 base64url characters SHALL also return `400 VALIDATION_ERROR` (SDS 7.1, row 25) and count no view.

#### Scenario: S-AB1008-06 an invalid expiry or malformed parameter returns 400 VALIDATION_ERROR
- **WHEN** an owner posts `expiresAt` values `<Clock now - 1 minute>`, `"not-a-date"` and `<Clock now + 366 days>` to `POST /notes/:noteId/shares`, calls `POST /shares/not-a-uuid/revoke`, and a visitor calls `GET /public/shares/short`
- **THEN** each response is `400` with `error.code` `VALIDATION_ERROR` and `error.details` naming `expiresAt`, `shareId` or `token` respectively, and no `ShareLink` row is created or changed
