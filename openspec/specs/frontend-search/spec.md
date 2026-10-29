# frontend-search Specification

## Purpose
Defines the search box on the notes list, its debounced requests, and the safe rendering of highlighted results.

## Requirements

### Requirement: Debounced search box and results (AC-FESRCH-01, AC-FESRCH-02, AC-FESRCH-03, AC-FESRCH-07)
The notes list page SHALL have a search box. A search SHALL be sent to `GET /search` only 300 ms after the last keystroke and only when the trimmed query has at least 2 characters (ERR-SRCH-01 is never sent). Each result SHALL show the title from `titleHighlight` and the `snippet` with matched words highlighted, and choosing a result SHALL open `/notes/:id`.

#### Scenario: S-AB1013-01 typing searches after the debounce and a result opens the note
- **WHEN** a signed-in user types `b` and then `bu` into the search box, and 300 ms pass with no more typing
- **THEN** no request is sent for `b`, exactly one `GET /search?q=bu&page=1&pageSize=20` is sent, and each result shows its title and snippet with the matched words inside `<mark>`
- **WHEN** the user chooses a result
- **THEN** the app navigates to `/notes/<id>` of that result

### Requirement: Safe highlight rendering (AC-FESRCH-04)
`parseHighlight` SHALL split text only on the exact tokens `<mark>` and `</mark>` and SHALL decode only `&amp;`, `&lt;`, `&gt;`, `&quot;` and `&#39;`. Segments SHALL be rendered as React text nodes (highlighted ones wrapped in `<mark>`), and the UI SHALL NOT use `dangerouslySetInnerHTML` or `innerHTML` for note content **[ASSUMPTION — confirm]** (SA-34).

#### Scenario: S-AB1013-02 only mark is honoured and everything else is shown as text
- **WHEN** a result has `snippet` `&lt;script&gt;alert(1)&lt;/script&gt; <mark>plan</mark> &amp; &quot;q&quot; &#39;x&#39; &lt;mark&gt;fake&lt;/mark&gt;`, and unbalanced (`</mark>` alone) and nested-looking (`<mark><mark>a</mark></mark>`) input is also parsed
- **THEN** the page shows the literal text `<script>alert(1)</script>`, `&`, `"q"`, `'x'` and `<mark>fake</mark>`, no `script` element exists in the DOM, only `plan` is inside a real `mark` element, and unbalanced or nested input never throws and never produces other elements

### Requirement: Pagination and result states (AC-FESRCH-05, ERR-SRCH-05)
Results SHALL be paginated with the API's `page`, `pageSize` and `totalPages`, and the view SHALL show a loading state, a no-results state when `items` is empty, and an error state (see below). Notes of other users and soft-deleted notes never appear because the API never returns them.

#### Scenario: S-AB1013-03 results paginate and an empty page shows the no-results state
- **WHEN** a search answers `200` with `total` 25 and `totalPages` 2, the user goes to page 2, and later searches a word that answers `200` with `items` `[]`
- **THEN** a loading indicator shows while each request is pending, page 2 is requested as `page=2`, the Previous control returns to page 1, and the empty answer shows a "no results" message with no result list

### Requirement: Clearing the search (AC-FESRCH-06)
Clearing the search box (or reducing it below 2 characters) SHALL return to the normal notes list and SHALL drop any pending or shown search results.

#### Scenario: S-AB1013-04 clearing the box returns to the normal notes list
- **WHEN** search results are shown and the user clears the search box
- **THEN** the normal notes list is shown, the `q` URL parameter is removed, and a response still in flight for the old query is not displayed

### Requirement: Error states (AC-FESRCH-05, ERR-SRCH-01 to ERR-SRCH-03)
A failed search SHALL show an error state with a retry action and SHALL keep the typed query. `400 VALIDATION_ERROR` and `500 INTERNAL_ERROR` SHALL show the server's message. Operator characters such as `&`, `!`, `(`, `)` and `:` SHALL be sent as plain text in `q` (URL-encoded) with no client-side stripping.

#### Scenario: S-AB1013-05 a 400 or 500 shows an error state with retry and operator text is sent plain
- **WHEN** the user searches `a & !(b:*)` and the server answers `400 VALIDATION_ERROR`, then after pressing Retry answers `500 INTERNAL_ERROR`, then after another Retry answers `200`
- **THEN** each failure shows an error message and a Retry button while the box still holds `a & !(b:*)`, the request carries `q` URL-encoded exactly as typed, and the `200` replaces the error with results

### Requirement: Unauthorized search (ERR-SRCH-04)
A `401 UNAUTHORIZED` from `GET /search` SHALL go through the shared `apiFetch` behaviour: one refresh and one retry; if the refresh fails the session SHALL be cleared and the user sent to `/login`.

#### Scenario: S-AB1013-06 a 401 refreshes once and a failed refresh sends the user to login
- **WHEN** `GET /search` answers `401 UNAUTHORIZED` and `POST /auth/refresh` succeeds, and then in a second search `GET /search` answers `401` and `POST /auth/refresh` answers `401`
- **THEN** the first search is retried once with the new token and shows its results, and the second clears the session and navigates to `/login` without showing results or an error list
