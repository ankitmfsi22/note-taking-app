## Phase 1: measure

- [x] 1.1 Add `scripts/lighthouse.mjs`, the `perf:lighthouse` script and the gitignored report folder
- [x] 1.2 Record the BEFORE scores

## Phase 2: fix (frontend)

- [x] 2.1 Static SEO assets: description, theme-color, favicon, robots.txt, font preload
- [x] 2.2 `useDocumentMeta` and its use in every route
- [x] 2.3 Inline CSS and preview cache headers (`frontend/vite-plugins.ts`)
- [x] 2.4 Layout stability on the notes list
- [x] 2.5 Landmarks, skip link, nav, heading order
- [x] 2.6 AA contrast for the destructive colour

## Phase 3: tests

- [x] 3.1 Component tests S-AB1016-13 to S-AB1016-21, S-AB1016-23, S-AB1016-24, S-AB1016-25
- [x] 3.2 Playwright axe test S-AB1016-22

## Phase 4: verify and document

- [x] 4.1 Re-run Lighthouse for AFTER scores
- [x] 4.2 README section, scripts table, status
