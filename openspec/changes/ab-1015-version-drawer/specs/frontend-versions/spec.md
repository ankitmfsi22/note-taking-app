## Purpose

Defines the editor's version history drawer: browsing versions read-only and restoring one safely after flushing pending edits.

## ADDED Requirements

### Requirement: List and view versions (AC-FEVER-01, AC-FEVER-02)
A drawer opened from the editor SHALL call `GET /notes/:noteId/versions` and list the versions newest first with version number and time. Selecting a version SHALL call `GET /notes/:noteId/versions/:versionNumber` and show its title and content read-only.

#### Scenario: S-AB1015-01 the drawer lists versions and shows a selected one read-only
- **WHEN** a signed-in user opens the drawer on a note with versions 1 to 3 and selects version 2
- **THEN** versions 3, 2 and 1 are listed in that order with number and time, and version 2's title and content are shown with no editing controls

### Requirement: Restore with flush (AC-FEVER-03, AC-FEVER-04, AC-FEVER-07)
Restoring a selected version SHALL ask for confirmation, then await `flush()` of the editor save store, then call `POST /notes/:noteId/versions/:versionNumber/restore`. If `flush()` fails the restore SHALL NOT be sent and an error SHALL be shown. On success the editor SHALL show the returned content and the version list SHALL be refetched so the new version is at the top.

#### Scenario: S-AB1015-02 restore flushes pending edits first then updates the editor and list
- **WHEN** the editor has an unsaved edit, the user selects version 1, confirms the restore, and the flush succeeds
- **THEN** the flush is called before the restore request, the restore returns `200`, the editor shows version 1's content, and the list shows a new top version

#### Scenario: S-AB1015-05 a failed flush blocks the restore
- **WHEN** the editor has an unsaved edit, the user confirms a restore, and `flush()` fails
- **THEN** no restore request is sent, an error is shown, and the editor content is unchanged

### Requirement: Latest version blocked (AC-FEVER-05, ERR-VER-03)
The restore action SHALL be disabled with an explanation for the latest version. A `409 VERSION_ALREADY_CURRENT` from the server SHALL show the same explanation and create no new version.

#### Scenario: S-AB1015-03 restoring the latest version is blocked
- **WHEN** the user selects the latest version, and separately the server answers a restore with `409` `VERSION_ALREADY_CURRENT`
- **THEN** the restore button is disabled with an explanation for the latest version, and the `409` shows the same explanation with the list unchanged

### Requirement: Drawer states and errors (AC-FEVER-06, ERR-VER-01, ERR-VER-02, ERR-VER-06)
The drawer SHALL show loading, empty and error states, and load further pages on request. A `404` (`NOTE_NOT_FOUND`, `VERSION_NOT_FOUND`) or `500` SHALL be shown as an error and leave the editor unchanged.

#### Scenario: S-AB1015-04 loading, empty, paging and error states
- **WHEN** the drawer opens while the list request is pending, then returns an empty list, then a first page with more pages, then a restore answers `404` `VERSION_NOT_FOUND` and another answers `500` `INTERNAL_ERROR`
- **THEN** a loading state, an empty state and a "Load more" that appends page 2 are shown, and each failed restore shows an error with the editor content unchanged

### Requirement: Authentication (ERR-VER-05)
A `401` on a version request SHALL trigger one refresh through `apiFetch`; if the refresh fails the user SHALL be sent to `/login`.

#### Scenario: S-AB1015-06 an expired session is refreshed once then redirected
- **WHEN** the drawer's list request answers `401` and the refresh also answers `401`
- **THEN** the refresh is attempted once and the user is redirected to `/login`
