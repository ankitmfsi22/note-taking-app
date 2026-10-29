## Purpose

List the caller's notes with pagination, deterministic sorting and an optional tag filter.

## ADDED Requirements

### Requirement: Paginated notes list (AC-LIST-01, AC-LIST-02, AC-LIST-06, AC-LIST-07)
`GET /api/v1/notes` SHALL return only the caller's notes whose `deletedAt` is null, as `NoteListResponseSchema`: `{ items, page, pageSize, total, totalPages }`. `page` defaults to 1 and `pageSize` to 20 (max 100). Each item SHALL be `{ id, title, preview, tags, createdAt, updatedAt }`, where `preview` is the first 150 characters of `contentText` with whitespace collapsed (SDS 8.1). A page beyond the last SHALL return `200` with empty `items` and correct totals.

#### Scenario: S-AB1005-01 default list returns the first page with pagination meta
- **WHEN** a user with 25 notes calls `GET /notes` with no query, then `GET /notes?page=4`
- **THEN** the first response is `200` with 20 items ordered by `updatedAt` descending, each with `id`, `title`, `preview`, `tags`, `createdAt` and `updatedAt`, and `page` 1, `pageSize` 20, `total` 25, `totalPages` 2; the second is `200` with `items` empty, `total` 25 and `totalPages` 2

### Requirement: Deterministic sorting (AC-LIST-03, AC-LIST-04)
The list SHALL sort by `sortBy` (`updatedAt`, `createdAt` or `title`, default `updatedAt`) and `sortOrder` (`asc` or `desc`, default `desc`). Ties SHALL be broken by `id` in the same direction, so pages never overlap or skip a note. Title order uses the database default collation **[ASSUMPTION — confirm]** (Recommended: default collation, no case folding).

#### Scenario: S-AB1005-02 sort by title ascending breaks ties by id
- **WHEN** a user has notes titled `b`, `a`, `a` and calls `GET /notes?sortBy=title&sortOrder=asc`
- **THEN** the response is `200` with the two `a` notes first, ordered by `id` ascending, followed by `b`

### Requirement: Query validation (ERR-LIST-01, ERR-LIST-02, ERR-LIST-03)
The query SHALL be validated by `NoteListQuerySchema` before any database access. A `page` below 1, a `pageSize` below 1 or above 100, a non-numeric value, an unknown `sortBy` or `sortOrder`, or a `tagIds` entry that is not a UUID (or more than 10 entries) SHALL fail with `400 VALIDATION_ERROR` and `details`. Duplicate `tagIds` are removed before the limit, and an empty `tagIds` value is rejected **[ASSUMPTION — confirm]** (Recommended default).

#### Scenario: S-AB1005-03 invalid query parameters return 400 VALIDATION_ERROR
- **WHEN** a logged-in user calls `GET /notes` with `pageSize=101`, then `page=0`, then `page=abc`, then `sortBy=color`, then `sortOrder=up`, then `tagIds=not-a-uuid`
- **THEN** each response is `400` with `error.code` `VALIDATION_ERROR` and `error.details` naming the offending field

### Requirement: Authentication and ownership (AC-LIST-01, ERR-LIST-05)
The list SHALL require a valid access token; without one it SHALL return `401 UNAUTHORIZED`. Every query SHALL filter by the caller's `userId`, so another user's notes never appear in `items` or `total`.

#### Scenario: S-AB1005-04 no token returns 401 and other users' notes are never listed
- **WHEN** a request to `GET /notes` has no `Authorization` header, and user A (2 notes) calls `GET /notes` while user B has 3 notes
- **THEN** the first response is `401` with `error.code` `UNAUTHORIZED`; user A's response is `200` with only A's 2 notes and `total` 2

### Requirement: Soft-deleted notes excluded (AC-LIST-01)
Notes with `deletedAt` set SHALL NOT appear in `items` and SHALL NOT count in `total` or `totalPages`, with or without a tag filter.

#### Scenario: S-AB1005-05 soft-deleted notes are excluded from items and totals
- **WHEN** a user has 3 notes, soft-deletes one with `DELETE /notes/:noteId`, then calls `GET /notes`
- **THEN** the response is `200` with 2 items, `total` 2, and the deleted note's `id` is absent

### Requirement: Tag filter (AC-LIST-05, AC-LIST-08, ERR-LIST-04)
`tagIds` (comma-separated, max 10) SHALL restrict the list to notes having at least one of the tags (OR), each note once, via `EXISTS` (SDS 7.3). Any `tagIds` entry that does not exist or is not the caller's SHALL return `404 TAG_NOT_FOUND`. This needs the `Tag` and `NoteTag` tables that SDS 6.4 assigns to AB-1006 **[ASSUMPTION — confirm]** (Recommended: AB-1005 pulls the two models forward with no tag endpoints, and SDS 6.4 is updated).

#### Scenario: S-AB1005-06 tag filter matches any tag once and rejects a foreign tag
- **WHEN** a user has tags T1 and T2, note N1 tagged T1 and T2, N2 tagged T2, N3 untagged, and calls `GET /notes?tagIds=T1,T2`, then `GET /notes?tagIds=<tag of another user>`
- **THEN** the first response is `200` with exactly N1 and N2, each once, and `total` 2; the second is `404` with `error.code` `TAG_NOT_FOUND`
