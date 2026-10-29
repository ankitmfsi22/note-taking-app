## Purpose

Keep an immutable, numbered snapshot of a note's title and content on every change, so its owner can list, view and restore earlier versions.

## ADDED Requirements

### Requirement: Snapshot on save (AC-VER-01, AC-VER-02, AC-VER-03, AC-VER-04, AC-VER-09, AC-VER-11)
Creating a note SHALL create version 1. A `PATCH` that changes title or content SHALL, in one transaction holding a row lock on the note, update the note, increment `lastVersionNumber` and insert an immutable version with that number, title and content (tags not versioned). A save identical to the current note SHALL be a no-op. `NoteResponse.latestVersion` SHALL equal the latest number.

#### Scenario: S-AB1009-01 save creates a snapshot and an identical save creates none
- **WHEN** a user creates a note, patches its title, then patches it again with the same title and content
- **THEN** the create returns `201` with `latestVersion` `1`, the first `PATCH` returns `200` with `latestVersion` `2` and version 2 holds the new title and content, and the second `PATCH` returns `200` with `latestVersion` `2`, no version 3 and `updatedAt` unchanged

### Requirement: List and view versions (AC-VER-05, AC-VER-06, ERR-VER-02)
`GET /api/v1/notes/:noteId/versions` SHALL return the retained versions of the caller's note, newest first, as `VersionListResponse` (`versionNumber`, `title`, `createdAt`, no content), paginated. `GET /api/v1/notes/:noteId/versions/:versionNumber` SHALL return `VersionDetail` with the full content, read-only. A version number that does not exist or was purged SHALL give `404 VERSION_NOT_FOUND`.

#### Scenario: S-AB1009-02 list versions paginated newest first and view one
- **WHEN** a user's note has versions 1 to 3 and the user calls `GET /notes/:noteId/versions?page=1&pageSize=2`, then `GET /notes/:noteId/versions/1`, then `GET /notes/:noteId/versions/9`
- **THEN** the list is `200` with `items` versions 3 and 2 without `content`, `total` `3` and `totalPages` `2`; the detail is `200` with version 1's title and content; and version 9 is `404` with `error.code` `VERSION_NOT_FOUND`

### Requirement: Restore a version (AC-VER-07, ERR-VER-03, ERR-VER-06)
`POST /api/v1/notes/:noteId/versions/:versionNumber/restore` SHALL, in the save transaction, set the note to version N's title and content and create a new latest version, leaving existing versions unchanged, and return `200 NoteResponse`. A target equal to the current title and content SHALL give `409 VERSION_ALREADY_CURRENT` **[ASSUMPTION — confirm]** (Recommended, SDS SA-20). A failure SHALL roll back everything.

#### Scenario: S-AB1009-03 restore creates a new version and updates the note
- **WHEN** a user's note has versions 1 to 3, the user restores version 1, then restores version 4, then restores version 2 while the version insert is made to fail
- **THEN** the first restore is `200` with version 1's title and content and `latestVersion` `4`, versions 1 to 3 are unchanged; restoring version 4 is `409` with `error.code` `VERSION_ALREADY_CURRENT` and no version 5; and the failed restore returns `500` `INTERNAL_ERROR` with the note and its versions unchanged

### Requirement: Keep the newest 50 versions (AC-VER-08, AC-VER-04)
Inside the save transaction the system SHALL delete versions with `versionNumber <= new - 50`, keeping exactly the newest 50 and never the latest, with no age rule **[ASSUMPTION — confirm]** (Recommended, SDS SA-22). Version numbers SHALL never be reused after a purge, because `lastVersionNumber` only increases.

#### Scenario: S-AB1009-04 only the newest 50 versions are kept
- **WHEN** a user's note reaches version 51 through 50 changing `PATCH` requests, then the user requests version 1 and lists the versions
- **THEN** version 1 is `404` with `error.code` `VERSION_NOT_FOUND`, the list has `total` `50` with versions 51 down to 2, and the next changing `PATCH` creates version 52 and removes version 2

### Requirement: Ownership and authentication (ERR-VER-01, ERR-VER-05, AC-VER-10, FR-X-1)
Every version endpoint SHALL require a valid access token, else `401 UNAUTHORIZED`. A note that is missing, owned by another user or soft-deleted SHALL give `404 NOTE_NOT_FOUND`, never `403`. Versions of a soft-deleted note SHALL be kept while the note is kept and become reachable again after the note is restored **[ASSUMPTION — confirm]** (Recommended, FRS A-31).

#### Scenario: S-AB1009-05 another user's or a deleted note returns 404 and no token returns 401
- **WHEN** user B lists, views and restores versions of user A's note; user A does the same on their own soft-deleted note; and a request is made with no `Authorization` header
- **THEN** user B and the deleted-note calls each get `404` with `error.code` `NOTE_NOT_FOUND` and A's note is unchanged, and the request without a token gets `401` with `error.code` `UNAUTHORIZED`

### Requirement: Input validation (ERR-VER-04)
A `noteId` that is not a UUID, a `versionNumber` that is not an integer of at least 1, or a `page` or `pageSize` outside `PaginationQuerySchema` SHALL fail with `400 VALIDATION_ERROR` and field-level `details`, before any database access.

#### Scenario: S-AB1009-06 malformed version number or pagination returns 400 VALIDATION_ERROR
- **WHEN** a user calls `GET /notes/not-a-uuid/versions`, `GET /notes/:noteId/versions/0`, `POST /notes/:noteId/versions/abc/restore` and `GET /notes/:noteId/versions?pageSize=101`
- **THEN** each response is `400` with `error.code` `VALIDATION_ERROR` and `error.details` naming `noteId`, `versionNumber`, `versionNumber` and `pageSize` respectively, and no version is created
