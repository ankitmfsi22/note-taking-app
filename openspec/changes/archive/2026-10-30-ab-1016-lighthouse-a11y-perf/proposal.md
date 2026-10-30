## Why

A Lighthouse run on the production build (mobile and desktop, five pages) showed gaps: SEO 82 (no meta description, `robots.txt` answered with the SPA HTML), a layout shift of 0.63 on the notes list, render-blocking CSS, a late-discovered font, no cache headers and no per-route titles. This change fixes them and keeps them fixed with tests.

## What Changes

- Frontend only. No API, schema, error-code or business-rule change.
- SEO: static description, `theme-color`, favicon and `robots.txt`; a small `useDocumentMeta` hook sets a unique title and description per route and `noindex` on authenticated pages, private share pages, the password-reset page and 404.
- Performance: the production build inlines the small stylesheet and preloads the critical font; the notes list reserves the tag-filter row and mounts the tag manager only once the list has settled (zero layout shift); `vite preview` (how the production build is served; the backend serves only the API) sends `Cache-Control: public, max-age=31536000, immutable` for hashed `/assets/` and `no-cache` for HTML, with gzip.
- Accessibility: skip link, `nav` landmark with links to Notes and Shared links (the shares page had no entry point), one `h1` per page with a logical heading order.
- Tooling: `pnpm perf:lighthouse` (scripts/lighthouse.mjs) reproduces the measurement; reports go to the gitignored `lighthouse-reports/`.
- Tests: axe-core checks in component tests and one Playwright check with `@axe-core/playwright`.

## FRS coverage

The FRS has no accessibility, performance or SEO acceptance criteria. **[ASSUMPTION — confirm]** This is a non-functional polish requested for AB-1016 by the project lead; it covers no FRS requirement and must not change any. Existing FRS scenarios (AC-FEAUTH, AC-FELIST, AC-FEEDIT, AC-SHARE and the others) stay green.

Authorization-denied and validation-failure scenarios do not apply: no endpoint is added or changed.

## Out of scope

API changes, server-side rendering, a service worker, real-user monitoring, a Lighthouse CI gate, dark-mode theming.

## Impact

`frontend/` (index.html, public/, vite.config.ts, routes, pages), `scripts/lighthouse.mjs`, `e2e/tests/a11y.spec.ts`, `README.md`. Capability `frontend-quality` (new).

## Rollback

Revert the commits. No data or API is affected.
