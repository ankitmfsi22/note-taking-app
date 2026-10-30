## MODIFIED Requirements

### Requirement: Per-route document metadata
Every route SHALL set a unique title (`<page> | Note App`) and meta description, with one of each tag in the head. Only private share, password-reset and not-found pages SHALL carry `noindex, nofollow`; authenticated pages need a login and carry no robots tag. **[ASSUMPTION — confirm]** Share links default to noindex.

#### Scenario: S-AB1016-13 the hook sets the title and description
- **WHEN** a component calls `useDocumentMeta` with a title and a description
- **THEN** `document.title` is `<title> | Note App`, `meta[name=description]` holds the description and only one description tag exists after a second call

#### Scenario: S-AB1016-14 noindex is added and removed with the route
- **WHEN** a route with `noindex` is replaced by one without
- **THEN** `meta[name=robots]` is `noindex, nofollow` first and absent afterwards

#### Scenario: S-AB1016-15 public routes have distinct titles and stay indexable
- **WHEN** the sign-in, registration and forgot-password routes render
- **THEN** each has its own title and description and no robots tag

#### Scenario: S-AB1016-16 private routes are noindex
- **WHEN** the notes list, trash, shared links, a public share page, the reset-password page and an unknown route render
- **THEN** each has its own title and description, the first three carry no robots tag, and the share page, the reset page and the 404 page carry `noindex, nofollow`

### Requirement: Static SEO assets
The build SHALL ship `index.html` with `lang`, viewport, a description, `theme-color`, a favicon link and a preload of the critical font, and a `robots.txt` that allows crawling and disallows nothing. A `Disallow` would stop crawlers from fetching the private share page and the reset page, so they would never see the meta `noindex` that keeps them out of the index.

#### Scenario: S-AB1016-17 index.html and robots.txt carry the SEO basics
- **WHEN** `frontend/index.html` and `frontend/public/robots.txt` are read
- **THEN** the page declares `lang="en"`, a viewport, a description, a theme colour, an icon and a font preload, and robots.txt has `User-agent: *` and `Allow: /` with no `Disallow` line
