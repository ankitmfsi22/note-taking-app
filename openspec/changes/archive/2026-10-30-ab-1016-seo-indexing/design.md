## Decisions

- **Authenticated pages carry no robots tag.** A crawler is redirected to the sign-in page, so there is nothing to index, and the tag only lowered the Lighthouse SEO score.
- **`/s/:token` keeps `noindex, nofollow` and is not disallowed.** The meta tag only works if the crawler may fetch the page; a `Disallow` would hide it. The share API response already sends `X-Robots-Tag: noindex` (SDS 8.3). Lighthouse's `is-crawlable` fails this page by design, so its SEO score stays at 63.
- **Reset-password and 404 keep `noindex`.** The reset page takes the user's email in its query string and has no search value; a 404 page should not be indexed.
