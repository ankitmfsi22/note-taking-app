# frontend-quality Specification

## Purpose
Defines the non-functional quality of the frontend: SEO metadata, accessibility, layout stability and the caching of the production build.

## Requirements

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

### Requirement: Accessible structure
Every page SHALL have a labelled `main` landmark and one `h1`; the signed-in shell SHALL provide a skip link, a header and a labelled `nav`; every control SHALL have an accessible name; saving and toast status SHALL be announced through live regions.

#### Scenario: S-AB1016-18 the signed-in shell has landmarks and a skip link
- **WHEN** the app shell renders for a signed-in user
- **THEN** the page has a `banner`, a `navigation` named Main with Notes and Shared links, a `main` landmark and a first focusable Skip to main content link that targets it

#### Scenario: S-AB1016-19 form fields have accessible names
- **WHEN** the sign-in, registration, forgot-password and reset-password forms render
- **THEN** every input is found by its label

#### Scenario: S-AB1016-20 pages have no axe violations
- **WHEN** axe runs on the sign-in page, the notes list and the signed-in shell
- **THEN** it reports no violations

#### Scenario: S-AB1016-21 the notes page has a logical heading order
- **WHEN** the notes list renders with notes and tags
- **THEN** the page has one level-1 heading, and the tag manager and each note card are level-2 headings

#### Scenario: S-AB1016-22 browsers pass axe on the real pages
- **WHEN** Playwright runs axe on the sign-in, registration, notes, editor and public share pages
- **THEN** no violations are reported

### Requirement: Stable layout
The notes list SHALL reserve the tag-filter row while tags load, and SHALL mount the tag manager only after the list has settled, so loading data does not move visible content.

#### Scenario: S-AB1016-23 the tag filter row keeps its space while tags load
- **WHEN** the list toolbar renders with `tagsLoading` and no tags
- **THEN** a hidden placeholder of the filter-row height is present and no filter group is exposed

#### Scenario: S-AB1016-24 the tag manager waits for the notes
- **WHEN** the notes request is pending, then resolves
- **THEN** the Tags section is absent while it is pending and present afterwards

### Requirement: Cache headers for the production build
`vite preview`, which serves the production build, SHALL answer hashed files under `/assets/` with `Cache-Control: public, max-age=31536000, immutable` and everything else except `/api` with `no-cache`.

#### Scenario: S-AB1016-25 hashed assets are immutable and the HTML is revalidated
- **WHEN** the preview server is asked for a hashed asset and for `/`
- **THEN** the asset has the immutable one-year header and the document has `no-cache`
