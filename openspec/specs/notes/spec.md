# notes Specification

## Purpose
Let an authenticated user create, read, update and soft-delete their own rich-text notes, and list and restore deleted notes within 30 days.

## Requirements

### Requirement: Note create, read and update (AC-NOTE-01 to 05, ERR-NOTE-01)
`POST /api/v1/notes` SHALL create a note owned by the caller with a trimmed title of 1–200 characters and optional TipTap content (`TipTapDocSchema`, at most 512,000 bytes, default empty doc), returning `201 NoteResponse`. The server SHALL derive `contentText`. `GET` and `PATCH /notes/:noteId` SHALL return `200 NoteResponse`; `PATCH` SHALL change `updatedAt` **[ASSUMPTION — confirm]** (A-12). Invalid input SHALL give `400 VALIDATION_ERROR` with `details` and change nothing.

#### Scenario: S-AB1004-01 create, read and update an own note
- **WHEN** an authenticated user posts `{ "title": "Groceries", "content": <valid TipTap doc> }` to `POST /notes`, then calls `GET /notes/:noteId`, then `PATCH /notes/:noteId` with `{ "title": "Shopping" }` at a later `Clock` time
- **THEN** create returns `201` with `id`, the title, the content, `tags` `[]`, `createdAt` and `updatedAt`, the row has the caller's `userId` and the derived `contentText`; `GET` returns `200` with the same note; `PATCH` returns `200` with title `Shopping` and a later `updatedAt`

#### Scenario: S-AB1004-02 invalid note input returns 400 VALIDATION_ERROR
- **WHEN** an authenticated user posts `{ "title": "   " }` to `POST /notes`, and separately sends a `PATCH` with a 201-character title or content over 512,000 bytes
- **THEN** each response is `400` with `error.code` `VALIDATION_ERROR` and `error.details` naming the field (`title` or `content`), and no note is created or changed

### Requirement: Ownership and authentication (FR-X-1, FR-X-2, ERR-NOTE-02, ERR-NOTE-03, ERR-NOTE-06, ERR-NOTE-07)
Every note endpoint SHALL require a valid Bearer access token, else `401 UNAUTHORIZED`. A missing note or another user's note SHALL give `404 NOTE_NOT_FOUND` on read, update, delete and restore, never `403`, and SHALL NOT change any data. A `noteId` that is not a UUID SHALL give `400 VALIDATION_ERROR`.

#### Scenario: S-AB1004-03 another user's or a missing note returns 404 NOTE_NOT_FOUND
- **WHEN** user B calls `GET`, `PATCH` and `DELETE /notes/:noteId` and `POST /notes/:noteId/restore` with the id of user A's note, and with a random UUID that matches no note
- **THEN** every response is `404` with `error.code` `NOTE_NOT_FOUND`, and user A's note is unchanged

#### Scenario: S-AB1004-04 note operations without a valid token return 401, malformed id returns 400
- **WHEN** a client calls `POST /notes`, `GET /notes/:noteId` and `GET /notes/trash` with no `Authorization` header or an expired token, and an authenticated user calls `GET /notes/not-a-uuid`
- **THEN** the unauthenticated responses are `401` with `error.code` `UNAUTHORIZED`, and the malformed id response is `400` with `error.code` `VALIDATION_ERROR` and `error.details` naming `noteId`

### Requirement: Soft delete, trash and restore (AC-NOTE-06 to 10, ERR-NOTE-04, ERR-NOTE-05)
`DELETE /notes/:noteId` SHALL only set `deletedAt` and return `204`; no other column changes. A trashed note SHALL be `404 NOTE_NOT_FOUND` for read, update and repeat delete, with `deletedAt` unchanged. `GET /notes/trash` SHALL list notes with `deletedAt > now - 30 days`, newest deletion first. Restore SHALL clear `deletedAt` only inside that window, else `404 NOTE_NOT_FOUND`. Purge SHALL remove only `deletedAt <= now - 30 days` **[ASSUMPTION — confirm]** (A-14, SA-50).

#### Scenario: S-AB1004-05 soft delete hides the note, lists it in trash and restore brings it back
- **WHEN** a user deletes an own note at `Clock` time `T`, then calls `GET /notes/:noteId`, `PATCH /notes/:noteId`, `DELETE /notes/:noteId` again, `GET /notes/trash`, `POST /notes/:noteId/restore`, and restore once more
- **THEN** the first delete is `204` and the row still exists with `deletedAt = T` and unchanged `title`, `content` and `updatedAt`; `GET`, `PATCH` and the repeat delete are `404 NOTE_NOT_FOUND` with `deletedAt` still `T`; the trash list is `200` (not `400`, proving route order) with the note, `purgeAt = T + 30 days` and `daysRemaining` `30`; restore is `200 NoteResponse` and the note is readable again with `deletedAt` null; a second restore of the now active note is `404 NOTE_NOT_FOUND` (ERR-NOTE-05)

#### Scenario: S-AB1004-06 restore and purge at the 30-day boundary
- **WHEN** note X was deleted 30 days minus one second before `now` and note Y exactly 30 days before `now`, `TrashPurgeJob.run(now)` runs, and the user calls `POST /notes/:noteId/restore` for each
- **THEN** X survives the purge and its restore is `200`; Y is physically removed and its restore is `404` with `error.code` `NOTE_NOT_FOUND`

### Requirement: Automatic trash purge (AC-NOTE-09, SDS 8.5)
The server SHALL run the trash purge job automatically, once at startup and then every hour, using the injected `Clock`, and a failed run SHALL be logged without stopping later runs. The `JOBS_ENABLED` setting (default `true`) SHALL turn the schedule off when `false`; the purge then runs only through `pnpm --filter backend run job:purge`.

#### Scenario: S-AB1004-07 the purge job runs at startup and hourly, and JOBS_ENABLED=false turns it off
- **WHEN** background jobs are started with `JOBS_ENABLED` `true` and time advances by one hour, and separately with `JOBS_ENABLED` `false`
- **THEN** with `true` the trash purge runs once at startup with `Clock.now()` and again after one hour; with `false` nothing is scheduled and the purge never runs
