# Design: AB-1008 sharing

Spec: `specs/sharing/spec.md` (approved 2026-10-29). SDS 4.3, 6.2, 6.4, 7.1 (#21 to #25), 7.2, 8.3; ADR-0008. No SDS change, no new dependency, no frontend.

## Files

| Layer | Files |
| --- | --- |
| Shared | `schemas/share.ts` (all seven schemas; the expiry range check lives in the service because it needs the injected `Clock`), `constants/limits.ts` (`SHARE_EXPIRY_MAX_DAYS`), `types.ts`, `index.ts` |
| DB | `ShareLink` model, migration `sharing_share_link` |
| Backend | `modules/shares/{shares.repository,shares.service,shares.controller,shares.routes}.ts`; `app.ts` mounts `/api/v1/shares`, `/api/v1/public`, and `POST/GET /api/v1/notes/:noteId/shares` |

## Key decisions

- Token: `randomBytes(32).toString('base64url')`, stored plaintext with a unique index (SA-16).
- Public read is one `$queryRaw` tagged template `UPDATE ... FROM "Note" ... RETURNING` (SDS 8.3); expiry uses DB `now()`, `n."deletedAt" IS NULL` is repeated. Zero rows is `SHARE_LINK_NOT_FOUND`. No `requireAuth`, so `Authorization` is ignored; headers `Cache-Control: no-store`, `X-Robots-Tag: noindex`.
- `status` is derived in the service from `revokedAt` and `expiresAt` with the `Clock`. Expiry range: strictly after now, at most now + 365 days; the service throws `VALIDATION_ERROR` with `details[expiresAt]`.
- Ownership in the query: notes are looked up by `findFirst({ id, userId, deletedAt: null })`; links by `note: { userId }`. Revoke is `updateMany where revokedAt null` then re-read, so it is idempotent. The active list excludes revoked, expired and deleted-note links.
- Routing: owner routes use `requireAuth` per route (not `router.use`) so the public route stays anonymous. `tags` are not part of any share payload here, so no tag lookup is needed.

## Requirement to code

| Requirement | Code | Scenarios |
| --- | --- | --- |
| Create link | `create`, `CreateShareLinkRequestSchema` | 01 |
| Public read, atomic count | `viewPublic` raw SQL | 02 |
| Revoke and lists | `revoke`, `listForNote`, `listActive` | 03 |
| Unavailable links | zero-row `UPDATE` | 04 |
| Auth and ownership | `requireAuth`, `userId` in `WHERE` | 05 |
| Validation | shared params and body schemas | 06 |

Risks: lost increments (S-02, 50 parallel); route ordering of `/notes/:noteId/shares` vs notes router (mount shares routes before it).
