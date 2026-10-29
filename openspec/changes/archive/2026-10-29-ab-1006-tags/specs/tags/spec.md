## Purpose

Per-user coloured tags with note counts, and the attachment of tags to notes.

## ADDED Requirements

### Requirement: Create and list tags with note counts (AC-TAG-01, AC-TAG-03, AC-TAG-04, AC-TAG-05, AC-TAG-06)
`POST /api/v1/tags` SHALL create a tag owned by the caller and answer `201 TagResponse`; a missing colour SHALL default to `#6B7280` (FRS A-19). Two users may hold the same name. `GET /api/v1/tags` SHALL answer `200 TagListResponse`, unpaginated (SA-25), each tag with a `noteCount` of the caller's non-deleted notes (A-21). Order: `nameKey` ascending, then `id` **[ASSUMPTION — confirm]** (Recommended default). Colours are stored upper-cased **[ASSUMPTION — confirm]** (Recommended default).

#### Scenario: S-AB1006-01 create tags and list them with note counts that ignore soft-deleted notes
- **WHEN** user A posts `{ "name": "Work" }` to `POST /tags`, user B posts `{ "name": "Work", "color": "#FF0000" }`, A attaches "Work" to three notes and soft-deletes one of them, then A calls `GET /tags`
- **THEN** both creates return `201` (A's tag with `color` `#6B7280`), and A's list is `200` with exactly one item, "Work", `noteCount` `2`, and no tag of user B

### Requirement: Tag names are unique per user, ignoring case (AC-TAG-02, ERR-TAG-01)
A tag name SHALL be 1 to 30 characters after trimming and unique per user by `nameKey` = `name.trim().normalize('NFKC').toLowerCase()` (SDS 7.3, SA-13). Creating or renaming to a `nameKey` the user already has on another tag SHALL fail with `409 TAG_NAME_TAKEN` and change nothing; a unique violation from a concurrent create SHALL map to the same code. Renaming a tag to a case variant of its own name succeeds **[ASSUMPTION — confirm]** (Recommended default).

#### Scenario: S-AB1006-02 duplicate tag name in any letter case returns 409 TAG_NAME_TAKEN
- **WHEN** user A has tags "Work" and "Home", then posts `{ "name": " work " }` to `POST /tags` and sends `{ "name": "WORK" }` to `PATCH /tags/:tagId` for "Home"
- **THEN** both responses are `409` with `error.code` `TAG_NAME_TAKEN`, A still has exactly two tags and "Home" keeps its name

### Requirement: Tag and note-tag input validation (ERR-TAG-02, ERR-TAG-05, FR-X-3)
Every tag request SHALL be validated with its shared schema (SDS 7.2): `name` trimmed 1 to 30, `color` matching `/^#[0-9A-Fa-f]{6}$/`, `PATCH` with at least one of `name` or `color`, ids as UUIDs, and `tagIds` de-duplicated then at most 10 (FRS A-20). Invalid input SHALL fail with `400 VALIDATION_ERROR` and field-level `details`, and SHALL change no data.

#### Scenario: S-AB1006-03 invalid tag input returns 400 VALIDATION_ERROR and changes nothing
- **WHEN** user A posts `{ "name": "   " }`, a 31-character name, and `{ "name": "Ok", "color": "red" }` to `POST /tags`, sends `{}` to `PATCH /tags/:tagId`, and sends 11 distinct own tag ids to `PUT /notes/:noteId/tags`
- **THEN** every response is `400` with `error.code` `VALIDATION_ERROR` and `error.details` naming the field (`name`, `name`, `color`, the body, `tagIds`), no tag is created or changed, and the note's tags are unchanged

### Requirement: Tag ownership and authentication (FR-X-1, FR-X-2, ERR-TAG-03, ERR-TAG-04, ERR-TAG-06, ERR-TAG-07)
Queries SHALL include the caller's `userId`. Updating or deleting a missing or not-owned tag SHALL fail with `404 TAG_NOT_FOUND`. Setting tags with a missing or not-owned tag id SHALL fail with `404 TAG_NOT_FOUND`, note unchanged. A missing, not-owned or soft-deleted note SHALL fail with `404 NOTE_NOT_FOUND`, checked before the tags **[ASSUMPTION — confirm]** (Recommended default). Without a valid token every tag endpoint SHALL return `401 UNAUTHORIZED`.

#### Scenario: S-AB1006-04 another user's tag or note returns 404 and a missing token returns 401
- **WHEN** user B sends `PATCH` and `DELETE` to `/tags/:tagId` for A's tag, B sends `PUT /notes/:noteId/tags` for B's own note with A's tag id, B sends it for A's note and for B's soft-deleted note with B's tag id, and a client calls `GET /tags` without a token
- **THEN** the tag requests return `404` with `error.code` `TAG_NOT_FOUND`, the two note requests return `404` with `NOTE_NOT_FOUND`, the tokenless request returns `401` with `UNAUTHORIZED`, and no tag or note-tag row changed

### Requirement: Rename, recolour and delete tags (AC-TAG-04, AC-TAG-08, AC-TAG-09)
`PATCH /api/v1/tags/:tagId` SHALL update `name` and/or `color` and answer `200 TagResponse`; the change SHALL be visible on every note that uses the tag. `DELETE /api/v1/tags/:tagId` SHALL answer `204`, remove the tag and its `NoteTag` rows by cascade (SDS 6.3), and SHALL NOT change any note's title, content, `updatedAt` or versions.

#### Scenario: S-AB1006-05 rename and recolour show on notes, delete detaches without touching notes
- **WHEN** user A's tag "Work" is on note N, A sends `{ "name": "Job", "color": "#00AA00" }` to `PATCH /tags/:tagId`, reads N, then sends `DELETE /tags/:tagId` and reads N again
- **THEN** the `PATCH` returns `200` with the new name and colour (`#00AA00`), N's `tags` show "Job" with that colour, the `DELETE` returns `204`, and N then has no tags while its title, content and `updatedAt` are unchanged

### Requirement: Replace the tags of a note (AC-TAG-07)
`PUT /api/v1/notes/:noteId/tags` (`SetNoteTagsRequestSchema`) SHALL replace the note's whole tag set with the given ids in one transaction and answer `200 NoteResponse`; an empty list removes all tags. It SHALL NOT change `Note.updatedAt` and SHALL create no version (SDS 7.3, SA-24). The order of `NoteResponse.tags` is by `nameKey` ascending **[ASSUMPTION — confirm]** (Recommended default).

#### Scenario: S-AB1006-06 setting note tags replaces the whole set in one transaction
- **WHEN** user A's note N has tags "Home" and "Work", and A sends `{ "tagIds": [work, ideas, ideas] }` to `PUT /notes/:noteId/tags`, then sends `{ "tagIds": [] }`
- **THEN** the first response is `200` with `tags` exactly "Ideas" and "Work" (duplicate removed), N's `updatedAt` is unchanged, and the second response is `200` with `tags` `[]`
