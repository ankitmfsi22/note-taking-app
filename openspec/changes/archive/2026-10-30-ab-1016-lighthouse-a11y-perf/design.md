## Context

Production serves static files through `vite preview`; the Express backend serves only `/api/v1`. The app is already route-split with `lazy` (TipTap and ProseMirror sit only in the editor chunk; the public share view renders its own lightweight tree), and fonts are self-hosted (`@fontsource-variable/geist`).

## Decisions

- **Metadata hook, not React 19 `<title>` hoisting.** `index.html` carries static defaults, and a hoisted second `<title>` leaves the browser's choice undefined (React docs). `useDocumentMeta` updates the single existing tags in an effect (title, description, robots).
- **Cache headers** in a `configurePreviewServer` plugin in `vite.config.ts`; compression comes from `vite preview`. Documented in the README.
- **Inline CSS** (about 10 KB gzip) with a build-only plugin: removes the render-blocking request. The font is preloaded by an `index.html` link that Vite rewrites to the hashed file.
- **Layout shift:** reserve the tag-filter row; mount the tag manager after the notes list settles.
- **Skip the session hint.** The 401 from the silent `POST /auth/refresh` on guest pages is logged by Chrome and costs 4 points of Best Practices on those pages. Avoiding it needs a readable "has session" flag in web storage, which S-AB1010-04 forbids, or an API change, which is out of scope.
- **noindex versus the Lighthouse SEO score.** Lighthouse's `is-crawlable` audit fails every page that blocks indexing, so noindex pages (all authenticated pages and share links) score 63 in SEO by design. The project lead asked for noindex.
- **No `vitest-axe`** (0.1.0, unmaintained): a small helper runs `axe-core` 4.14.0 directly.

## Risks

Lighthouse scores vary by a few points with machine load; the script reports the median of N runs and logs in again before every authenticated run, because the refresh cookie rotates on each load.
