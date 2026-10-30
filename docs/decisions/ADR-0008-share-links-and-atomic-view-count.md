# ADR-0008: Share links, plaintext tokens and an atomic view count

- Status: Accepted (accepted with `docs/SDS.md` on 2026-10-28)
- Date: 2026-10-28
- Tickets: AB-1008 (backend), AB-1014 (frontend)
- SDS: Sections 6.2, 8.3

## Context

Users generate public, read-only links with optional expiry, revoke them, and see a view count (AC-SHARE-01 to 14). A note may have several links (FRS A-23). The public viewer must not be able to tell an unknown link from a revoked, expired or deleted-note link (A-26). Views must be counted exactly once each under concurrency (AC-SHARE-07). The owner must be able to copy a link again later (AC-FESHARE-02, AC-FESHARE-05).

## Decision

- **Token:** `crypto.randomBytes(32)` as base64url, 43 characters, 256 bits of randomness. Unique index.
- **Stored in plaintext.** The owner UI re-displays links, so a one-way hash would make that impossible. A database leak exposes read-only access to notes the owner chose to share, nothing more.
- **Status is derived,** not stored: `revokedAt` set means revoked; `expiresAt` not after now means expired; otherwise active. Expiry needs no job.
- **Revoke** is `POST /shares/:shareId/revoke`, an idempotent update that sets `revokedAt` only if it is null. The row stays so the owner still sees its view count.
- **Public read** is one SQL statement, `UPDATE "ShareLink" ... SET "viewCount" = "viewCount" + 1 ... FROM "Note" ... WHERE token matches AND revokedAt IS NULL AND (expiresAt IS NULL OR expiresAt > now()) AND note.deletedAt IS NULL RETURNING title, content, updatedAt`.
  - It checks every availability rule, increments, and returns the note data in one step, so no separate read can race with the count.
  - PostgreSQL's row lock serialises concurrent viewers, so no increment is lost.
  - Zero rows returned is always the same `404 SHARE_LINK_NOT_FOUND`, and nothing is counted.
  - Expiry uses the database clock.
- The public route ignores any `Authorization` header, exposes only title, content and last-updated time, and sends `Cache-Control: no-store`, `X-Robots-Tag: noindex` and `Referrer-Policy: no-referrer`.
- The active-links list excludes revoked, expired and soft-deleted-note links.

## Consequences

- The view count is exact, and the endpoint needs no transaction.
- Every public view writes to the database. For this scope that is fine.
- No unique-visitor logic, and no per-link rate limiting (out of scope).

## Alternatives considered

- **Hashed tokens:** rejected because owners must re-copy links.
- **Read the note, then increment in a second statement:** rejected; two steps can disagree if the link is revoked in between.
- **Count in application memory or a queue:** rejected; loses counts on restart and adds infrastructure.
- **`DELETE /shares/:shareId` to revoke:** rejected; the row is kept, so `DELETE` would mislead.
- **One link per note:** rejected; the FRS allows several, each with its own expiry, revoke state and count.
