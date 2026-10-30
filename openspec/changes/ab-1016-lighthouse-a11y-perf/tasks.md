## Phase 1: measure

- [x] 1.1 Add `scripts/lighthouse.mjs`, the `perf:lighthouse` script and the gitignored report folder
- [x] 1.2 Record the BEFORE scores

## Phase 2: fix (frontend)

- [x] 2.1 Static SEO assets: description, theme-color, favicon, robots.txt, font preload
- [x] 2.2 `useDocumentMeta` and its use in every route
- [x] 2.3 Inline CSS and preview cache headers in `vite.config.ts`
- [x] 2.4 Layout stability on the notes list
- [x] 2.5 Landmarks, skip link, nav, heading order

## Phase 3: tests

- [ ] 3.1 Component tests S-AB1016-06 to S-AB1016-14, S-AB1016-16, S-AB1016-17, S-AB1016-18
- [ ] 3.2 Playwright axe test S-AB1016-15

## Phase 4: verify and document

- [ ] 4.1 Re-run Lighthouse for AFTER scores
- [ ] 4.2 README section, scripts table, status
