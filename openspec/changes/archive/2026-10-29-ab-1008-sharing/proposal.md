## Why

Owners want to give read-only access to a note to someone without an account, control how long it lasts, and see how often it was read (US-SHARE-1 to 3). AB-1008 adds the backend of public share links. The share modal and public page come with AB-1014.

## What Changes

- `ShareLink` table in one Prisma migration (SDS 6.2): 256-bit base64url token stored in plaintext with a unique index, optional `expiresAt`, `revokedAt`, `viewCount` (ADR-0008, SA-16).
- Five endpoints (SDS 7.1, rows 21 to 25): create, list per note, list active, revoke (idempotent), and the public read `GET /public/shares/:token`.
- Shared schemas from SDS 7.2 (`CreateShareLinkRequestSchema`, `ShareIdParamsSchema`, `ShareTokenParamsSchema`, `ShareLinkResponseSchema`, `ShareLinkListResponseSchema`, `ActiveShareLinkListResponseSchema`, `PublicSharedNoteSchema`).
- Public read is one `UPDATE ... RETURNING` that checks availability, increments the count and returns the note (SDS 8.3). Zero rows is always `404 SHARE_LINK_NOT_FOUND`.

FRS: US-SHARE-1 to 3, AC-SHARE-01 to 14, ERR-SHARE-01 to 09. Codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOTE_NOT_FOUND`, `SHARE_LINK_NOT_FOUND` (SDS 4.3).

## Out of scope

Share modal, active-links page and `/s/:token` page (AB-1014); unique-visitor logic and rate limiting (ADR-0008); any change to SDS codes or endpoints.

## Impact and rollback

New capability `sharing`, additive migration, no new dependency. Rollback: revert the AB-1008 commits and drop the `ShareLink` table (it holds only share links).
