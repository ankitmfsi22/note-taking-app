## Why

The first AB-1016 Lighthouse change marked every authenticated page `noindex` and disallowed them in `robots.txt`. Lighthouse's `is-crawlable` audit fails any page that blocks indexing, so those pages scored 63 in SEO. They need a login and a crawler only ever sees the sign-in page there, so blocking them adds nothing.

## What Changes

- Frontend only. No API, schema, error-code or business-rule change.
- Remove `noindex` from the notes list, trash, shared links and note editor pages.
- Keep `noindex, nofollow` on the private share page (`/s/:token`), the password-reset page and the 404 page.
- `robots.txt` allows crawling and disallows nothing. A `Disallow` stops crawlers from fetching a page, so they would never read its `noindex` and could still list the bare URL. The meta tag is the real control.
- The trade-off is documented in the README and SDS section 9.7: `/s/:token` keeps an SEO score of 63 (`is-crawlable` fails by design).

## FRS coverage

The FRS has no SEO acceptance criteria (see the first change). Scenarios modified: S-AB1016-16 and S-AB1016-17. Authorization-denied and validation-failure scenarios do not apply: no endpoint changes.

## Out of scope

Anything outside page metadata and `robots.txt`.

## Impact

`frontend/` pages, `frontend/public/robots.txt`, tests, README, SDS 9.7. Capability `frontend-quality`.

## Rollback

Revert the commit.
