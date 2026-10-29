## Purpose
Defines the notes list page with paging, sorting and tag filtering kept in the URL, note creation and deletion, the tag manager, and the Trash view with restore.

## ADDED Requirements

### Requirement: List content and states (AC-FELIST-01, AC-FELIST-06)
The `/notes` page SHALL show each note with its title, preview, tags and last-updated date. It SHALL show distinct loading, empty and error states; the error state SHALL have a Retry action that sends the request again. **[ASSUMPTION — confirm]** (A-38)

#### Scenario: S-AB1011-01 list shows notes, loading, empty and error with retry
- **WHEN** the page opens and `GET /notes` has not answered yet
- **THEN** a loading state is shown
- **WHEN** it answers `200` with notes
- **THEN** each note shows its title, preview, tag names and updated date
- **WHEN** it answers `200` with no items
- **THEN** an empty state with a "New note" action is shown, and no note card
- **WHEN** it answers `500 INTERNAL_ERROR`, the user clicks Retry, and the next answer is `200`
- **THEN** an error message with a Retry button is shown first, and then the notes

### Requirement: Paging, sort and tag filter in the URL (AC-FELIST-02, AC-FELIST-03)
The page SHALL let the user change page, sort field (`updatedAt`, `createdAt`, `title`), sort direction and the tag filter (any of the chosen tags). Page, sort and tags SHALL be read from and written to the URL (`page`, `sortBy`, `sortOrder`, `tagIds`), and `GET /notes` SHALL be called from the URL values only.

#### Scenario: S-AB1011-02 page, sort and tag filter live in the URL
- **WHEN** the app is opened at `/notes?page=2&sortBy=title&sortOrder=asc&tagIds=<id1>,<id2>`
- **THEN** `GET /notes` is called with `page=2`, `sortBy=title`, `sortOrder=asc` and `tagIds=<id1>,<id2>`, and the sort controls and selected tags show those values
- **WHEN** the user picks another sort field, then selects a tag
- **THEN** the URL changes to match, the page resets to 1, and a new request with the new values is sent
- **WHEN** the URL has `page=abc` and `sortBy=bogus`
- **THEN** the defaults (page 1, `updatedAt`, `desc`) are used and no error is shown **[ASSUMPTION — confirm]**

### Requirement: New note and delete with confirmation (AC-FELIST-04, AC-FELIST-05)
The "New note" action SHALL call `POST /notes` and open `/notes/:noteId` for the created note. Deleting a note SHALL first open a confirmation dialog that says the note can be restored from Trash for 30 days, and SHALL call `DELETE /notes/:noteId` only after the user confirms. **[ASSUMPTION — confirm]** (A-36)

#### Scenario: S-AB1011-03 new note opens the editor, delete asks first
- **WHEN** the user clicks "New note" and the server answers `201` with a note
- **THEN** the browser navigates to `/notes/<id>` of that note
- **WHEN** the user clicks Delete on a note
- **THEN** a dialog says the note can be restored from Trash for 30 days and no `DELETE` request is sent
- **WHEN** the user cancels
- **THEN** the dialog closes and the note stays in the list
- **WHEN** the user confirms and the server answers `204`
- **THEN** the list is reloaded without that note

### Requirement: Tag manager (AC-FELIST-07)
The page SHALL have a tag manager to create, rename, recolour and delete tags and to show each tag's note count. The create and edit forms SHALL validate with the shared `TagCreateRequestSchema` and `TagUpdateRequestSchema` before sending, and SHALL show `409 TAG_NAME_TAKEN` and `400 VALIDATION_ERROR` `details` as field errors.

#### Scenario: S-AB1011-04 tag manager validates and manages tags
- **WHEN** the manager opens and `GET /tags` answers `200`
- **THEN** each tag shows its name, colour and note count
- **WHEN** the user submits the create form with an empty name or a 31-character name
- **THEN** a field error is shown on the name and no request is sent
- **WHEN** the user submits a valid name and the server answers `409 TAG_NAME_TAKEN`
- **THEN** the message is shown on the name field and the entered value is kept
- **WHEN** the user creates, renames, recolours and deletes a tag with `201`, `200` and `204` answers
- **THEN** the tag list and the note list tag chips are reloaded after each change

### Requirement: Trash view and restore (AC-FELIST-08, AC-FELIST-09)
`/notes/trash` SHALL list trashed notes from `GET /notes/trash` with title, deletion date and days remaining, and with loading, empty and error-with-retry states. Each row SHALL have a Restore action (`POST /notes/:noteId/restore`). A restore failing with `404 NOTE_NOT_FOUND` (ERR-NOTE-05) SHALL show a clear "can no longer be restored" message. **[ASSUMPTION — confirm]** (A-14)

#### Scenario: S-AB1011-05 trash lists notes with days remaining and restores them
- **WHEN** `/notes/trash` opens and `GET /notes/trash` answers `200` with a note deleted 25 days ago
- **THEN** its title, deletion date and "5 days left" are shown, and a loading state was shown before the answer
- **WHEN** the list is empty, or the request fails with `500 INTERNAL_ERROR`
- **THEN** an empty state, or an error with a Retry button, is shown
- **WHEN** the user clicks Restore and the server answers `200`
- **THEN** the row disappears and the normal list is reloaded and includes the note
- **WHEN** the user clicks Restore and the server answers `404 NOTE_NOT_FOUND`
- **THEN** a message says the note can no longer be restored, and the Trash list is reloaded

### Requirement: Unauthenticated access (AC-FEAUTH-05, AC-FEAUTH-07 applied to these pages)
`/notes` and `/notes/trash` SHALL need a session. A visitor without one SHALL be sent to `/login`. If a list request answers `401 UNAUTHORIZED` and the silent refresh is rejected, the session SHALL end and the login page SHALL be shown.

#### Scenario: S-AB1011-06 guest and expired session go to login
- **WHEN** a visitor opens `/notes/trash` and `POST /auth/refresh` answers `401 INVALID_REFRESH_TOKEN`
- **THEN** the login page is shown and no trash request is sent
- **WHEN** a signed-in user's `GET /notes` answers `401 UNAUTHORIZED`, and the refresh answers `401 INVALID_REFRESH_TOKEN`
- **THEN** the login page is shown and no error state with Retry is left on screen
