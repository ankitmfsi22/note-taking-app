# frontend-note-editor Specification

## Purpose
Defines how the web app edits a single note: a TipTap rich-text editor limited to the allowed formatting set, title and tag editing, autosave with a visible save status, a leave warning, and a not-found state.

## Requirements

### Requirement: Editor page and formatting set (AC-FEEDIT-01, AC-FEEDIT-09)
The route `/notes/:noteId` SHALL load the note and show an editable title, a TipTap editor and a toolbar for headings 1 to 3, bold, italic, strike-through, lists, block quote, code, link, undo and redo. The editor SHALL allow exactly the nodes and marks of `TipTapDocSchema` (SDS 8.1), so its output always passes that schema. The page SHALL show a Share button and a Version history button, disabled with an explanatory title until AB-1014 and AB-1015 **[ASSUMPTION — confirm]**.

#### Scenario: S-AB1012-01 the editor opens a note with the allowed formatting set and the share and history buttons
- **WHEN** an authenticated user opens `/notes/:noteId` and `GET /notes/:noteId` answers `200` with `NoteResponseSchema`
- **THEN** the title, the content and the toolbar buttons for the formatting set are shown, there is no underline or horizontal-rule control, and a Share button and a Version history button are present
- **WHEN** the user applies every toolbar format (including a link to `https://example.com`) to text in the editor
- **THEN** `editor.getJSON()` parses successfully with `TipTapDocSchema`

### Requirement: Title and tags (AC-FEEDIT-02)
The user SHALL be able to assign tags from their existing tags (`GET /tags`) and remove assigned tags. Each change SHALL send `PUT /notes/:noteId/tags` with `SetNoteTagsRequestSchema` and show the tags from the `200` response. If the request fails, the previous tags SHALL stay shown and an error toast SHALL appear. Creating, renaming and deleting tags is not part of the editor **[ASSUMPTION — confirm]**.

#### Scenario: S-AB1012-02 tags are assigned and removed
- **WHEN** the user picks an unassigned tag in the tag picker
- **THEN** `PUT /notes/:noteId/tags` is sent with the old tag IDs plus the new one and the note shows the returned tags
- **WHEN** the user removes an assigned tag
- **THEN** `PUT /notes/:noteId/tags` is sent without it and the tag disappears
- **WHEN** a `PUT` fails with `404 TAG_NOT_FOUND`
- **THEN** the tags before the change are shown again and an error toast is shown

### Requirement: Autosave and save status (AC-FEEDIT-03, AC-FEEDIT-04)
Title and content edits SHALL be saved with `PATCH /notes/:noteId` 2 seconds after the last edit, with no save button. Edits made during a save SHALL be coalesced into one later save with the latest values, and at most one save request SHALL be in flight. A status SHALL always be visible: `Saving`, `Saved` after a `200`, or `Failed` with a Retry button. The editor content SHALL NOT be replaced from the response.

#### Scenario: S-AB1012-03 edits autosave once after two seconds and the status follows
- **WHEN** the user types three times within 2 seconds
- **THEN** no request is sent before 2 seconds after the last edit, then exactly one `PATCH /notes/:noteId` is sent with the latest title and content, and the status reads `Saving` and then `Saved`
- **WHEN** the user edits again while that request is still in flight
- **THEN** no second request starts until the first ends, then one more `PATCH` is sent with the latest content, and the editor text is unchanged by either response

### Requirement: Failed saves keep edits and are retried (AC-FEEDIT-04, AC-FEEDIT-05)
If a save fails with a network error or `500 INTERNAL_ERROR`, the status SHALL be `Failed`, the edits SHALL stay in the editor, and the save SHALL be retried automatically after 2, 4 and 8 seconds; after the third retry fails the status stays `Failed` until the user presses Retry, which saves immediately. A success at any point SHALL set `Saved`. An error toast SHALL announce the first failure.

#### Scenario: S-AB1012-04 a failed autosave keeps the edits and retries at 2, 4 and 8 seconds, then waits for Retry
- **WHEN** the autosave `PATCH` fails with a network error and the user's edit is in the editor
- **THEN** the status is `Failed`, the edit is still shown, and retries are sent 2 s, then 4 s, then 8 s after each failure
- **WHEN** the third retry also fails
- **THEN** no further request is sent automatically and the Retry button is shown
- **WHEN** the user presses Retry and the server answers `200`
- **THEN** one `PATCH` with the latest content is sent and the status is `Saved`

### Requirement: Title and content validation (AC-FEEDIT-02, ERR-NOTE-01)
The title SHALL be validated with the shared title rule (trimmed, 1 to 200 characters) before a save is sent. An invalid title SHALL show a field error, SHALL NOT be sent, and the status SHALL be `Failed` with the message; content edits SHALL still be kept. If the server answers `400 VALIDATION_ERROR`, the `details` SHALL be shown on the matching field or as the status message, the edits SHALL stay, and the save SHALL NOT be retried automatically **[ASSUMPTION — confirm]**.

#### Scenario: S-AB1012-05 an empty or over-long title is rejected and a server validation error is shown
- **WHEN** the user clears the title, or enters 201 characters, and waits 2 seconds
- **THEN** a field error is shown, no `PATCH` is sent, and the content edits are kept
- **WHEN** the title is valid but the server answers `400 VALIDATION_ERROR` with `details` for `content`
- **THEN** the status is `Failed` with the server message, the edits stay in the editor, and no automatic retry is sent

### Requirement: Leaving with unsaved changes (AC-FEEDIT-06)
While the note has unsaved changes (dirty or saving), an in-app navigation SHALL be blocked with `useBlocker`, flush the pending save, and continue only if the save succeeds; if the save fails a "discard changes?" dialog SHALL let the user stay or leave. Closing or reloading the tab while there are unsaved changes SHALL trigger the browser `beforeunload` warning. Without unsaved changes, neither SHALL appear.

#### Scenario: S-AB1012-06 leaving with unsaved edits saves first, or asks, and the tab warns
- **WHEN** the user edits and immediately navigates to `/notes` and the flush `PATCH` answers `200`
- **THEN** the pending edit is saved first and the notes page is shown without a dialog
- **WHEN** the flush `PATCH` fails and the user navigates away
- **THEN** a "discard changes?" dialog is shown; Stay keeps the editor, Leave navigates
- **WHEN** there are unsaved changes and a `beforeunload` event fires
- **THEN** the event is cancelled (`defaultPrevented`); with no unsaved changes it is not

### Requirement: Missing note and expired session (AC-FEEDIT-07, ERR-NOTE-02 to ERR-NOTE-04, ERR-NOTE-06)
`404 NOTE_NOT_FOUND` from `GET /notes/:noteId` (missing, soft-deleted or another user's note, which the API does not tell apart) SHALL show a not-found state with a link back to `/notes`, never the editor. A `404 NOTE_NOT_FOUND` on a save SHALL show `Failed` with a "note no longer exists" message and no retry. A `401 UNAUTHORIZED` SHALL follow the silent refresh of `apiFetch`; if refresh fails the user SHALL be sent to `/login`.

#### Scenario: S-AB1012-07 a missing or other user's note shows not-found and an unrenewable session goes to login
- **WHEN** `GET /notes/:noteId` answers `404 NOTE_NOT_FOUND`
- **THEN** a not-found message with a link to `/notes` is shown and no editor or toolbar is rendered (authorization denied)
- **WHEN** `GET /notes/:noteId` answers `401 UNAUTHORIZED` and `POST /auth/refresh` answers `401 INVALID_REFRESH_TOKEN`
- **THEN** the login page is shown

### Requirement: No script execution (AC-FEEDIT-08)
The editor SHALL render content only through the TipTap schema (ProseMirror nodes), never through `innerHTML` or `dangerouslySetInnerHTML`. Pasted or typed HTML SHALL be parsed by the schema, so scripts, event-handler attributes, `javascript:` links and unknown elements are dropped. Stored content that contains a disallowed link SHALL NOT produce an executable link.

#### Scenario: S-AB1012-08 pasted script content never runs
- **WHEN** the user pastes `<p onclick="window.__x=1">hi<script>window.__x=2</script><a href="javascript:window.__x=3">go</a></p>` into the editor
- **THEN** the editor text contains `hi` and `go`, the DOM has no `script` element and no `onclick` attribute, no link with a `javascript:` href exists, `window.__x` is undefined, and `editor.getJSON()` passes `TipTapDocSchema`
