## Purpose

Full-text search over the caller's own non-deleted notes, ranked by relevance, paginated, with matched words safely highlighted.

## ADDED Requirements

### Requirement: Ranked, paginated full-text search
`GET /search` SHALL require a bearer token and SHALL use PostgreSQL full-text search only, over note title and content text, via a generated `searchVector` column kept current on every write (AC-SRCH-01, AC-SRCH-02, AC-SRCH-11). Results SHALL be ordered by `ts_rank` descending (title weight A above content weight B), then `updatedAt` descending, then `id` (AC-SRCH-04) **[ASSUMPTION — confirm]** (FRS A-22). Pagination SHALL follow AC-LIST-02 (AC-SRCH-07).

#### Scenario: S-AB1007-01 matching notes are returned ranked with pagination meta
- **WHEN** a user owns note A with title `Budget plan`, note B with content containing `budget`, and note C without the word, then edits note C's title to `Budget review`, and calls `GET /search?q=budget&page=1&pageSize=2`
- **THEN** the response is `200` with 2 `items` whose title matches (A and C) come first, ordered by rank then `updatedAt` descending, `page` 1, `pageSize` 2, `total` 3, `totalPages` 2, and each item has `id`, `title`, `titleHighlight`, `snippet`, `tags` and `updatedAt`

### Requirement: Safe highlighted snippets
Each result SHALL carry `titleHighlight` and a `snippet` in which every matched word is wrapped in `<mark>` (AC-SRCH-05) **[ASSUMPTION — confirm]** (FRS A-22). All other text SHALL be HTML-escaped (`&`, `<`, `>`, `"`, `'`) using random per-request nonce markers, so note text can never inject markup (AC-SRCH-06, SDS 8.2).

#### Scenario: S-AB1007-02 HTML in note text is escaped and only mark tags are added
- **WHEN** a user owns a note whose title is `Plan <b>` and whose content text is `<script>alert(1)</script> plan & "q" 'x' <mark>fake</mark>`, and calls `GET /search?q=plan`
- **THEN** `titleHighlight` is `<mark>Plan</mark> &lt;b&gt;`, the `snippet` contains `&lt;script&gt;`, `&amp;`, `&quot;`, `&#39;` and `&lt;mark&gt;fake&lt;/mark&gt;`, and the only unescaped tags in either string are `<mark>` and `</mark>` around `plan`

### Requirement: Query validation and plain-word handling
`q` SHALL be trimmed and SHALL be 2 to 200 characters, and pagination SHALL follow `PaginationQuerySchema`; otherwise the response SHALL be `400 VALIDATION_ERROR` (AC-SRCH-08, ERR-SRCH-01, ERR-SRCH-02) **[ASSUMPTION — confirm]** (FRS A-22). `q` SHALL be passed to `plainto_tsquery('english')` as a bound parameter of a Prisma tagged template, so operator syntax is plain text and never a server error (AC-SRCH-10, ERR-SRCH-03).

#### Scenario: S-AB1007-03 missing, too short, too long query or bad pagination returns 400 VALIDATION_ERROR
- **WHEN** an authenticated user calls `GET /search` with no `q`, with `q=%20a%20`, with a 201-character `q`, and with `q=budget&pageSize=101`
- **THEN** each response is `400` with `error.code` `VALIDATION_ERROR` and `error.details` naming `q` (or `pageSize` for the last), and no search query is run

#### Scenario: S-AB1007-04 operator syntax is treated as plain words
- **WHEN** a user owns a note containing `budget x` and calls `GET /search` with `q` equal to `budget & !(x:*) |`
- **THEN** the response is `200` (never `500`) and the note is returned, the query is read as the plain words `budget` and `x` (`plainto_tsquery` drops every operator character), and only those two words are highlighted

### Requirement: Scoped results and empty matches
Results SHALL include only the caller's notes with `deletedAt` null, enforced by `userId` and `"deletedAt" IS NULL` in the query (AC-SRCH-03, ERR-SRCH-05). A call without a valid access token SHALL be `401 UNAUTHORIZED` (ERR-SRCH-04). A query with no match, or made only of stop words, SHALL return `200` with empty `items` (AC-SRCH-09).

#### Scenario: S-AB1007-05 other users' and soft-deleted notes are never returned and no match gives an empty page
- **WHEN** user B owns a note titled `zebra` and user A owns a soft-deleted note titled `zebra`, and user A calls `GET /search?q=zebra` and then `GET /search?q=the`
- **THEN** both responses are `200` with `items` `[]`, `total` 0 and `totalPages` 0

#### Scenario: S-AB1007-06 search without a valid token returns 401 UNAUTHORIZED
- **WHEN** a client calls `GET /search?q=budget` with no `Authorization` header, and again with an expired access token
- **THEN** both responses are `401` with `error.code` `UNAUTHORIZED`
