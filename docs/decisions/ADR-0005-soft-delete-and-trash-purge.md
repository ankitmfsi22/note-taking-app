# ADR-0005: Soft delete with a 30-day window and a purge job

- Status: Proposed (approved together with `docs/SDS.md`)
- Date: 2026-10-28
- Tickets: AB-1004 (design and purge), AB-1011 (Trash view)
- SDS: Sections 6.5, 8.5

## Context

Rule 15: soft delete means setting `deletedAt` only. Note rows must never be physically deleted within the 30-day recovery window. The FRS adds a trash list and restore (AC-NOTE-08, A-14) and allows an automatic purge after 30 days (AC-NOTE-09). A soft-deleted note must disappear from lists, search, tag counts, share links and version access (AC-NOTE-07, AC-VER-10).

## Decision

- One nullable column, `Note.deletedAt timestamptz`. Delete and restore change only this column.
- Window arithmetic uses one boundary everywhere:
  - restorable: `deletedAt > now - 30 days`
  - purgeable: `deletedAt <= now - 30 days`
  There is no instant at which a note is both.
- Repository methods are named by scope (`findActiveByIdForUser`, `listTrashedForUser`, `markDeleted`, `markRestored`). No unscoped `findById` exists, and ESLint keeps Prisma access inside repositories.
- Raw SQL (search, public share view, version restore) repeats `"deletedAt" IS NULL` explicitly and is covered by tests that put a trashed note in each path.
- Purge: `TrashPurgeJob.run(now)` deletes in batches of 500 ids with `deletedAt <= cutoff`. Database `ON DELETE CASCADE` removes versions, tag links and share links. It runs at startup and then hourly from an in-process timer (`setInterval(...).unref()`), and is callable as `pnpm --filter backend run job:purge`. A `Clock` is injected so tests cross the boundary exactly.
- The same scheduler also removes expired refresh tokens and OTP rows (housekeeping).

## Consequences

- Rule 15 is enforced by naming, lint, boundary tests, and the fact that only the purge job can delete note rows.
- Trashed notes keep their share-link rows. If the note is restored inside the window, an unrevoked, unexpired link works again (AC-SHARE-13).
- An in-process timer runs in every instance. Deletes are idempotent, so duplicates are harmless. A real deployment can switch to an external cron calling the CLI.

## Alternatives considered

- **Prisma Client extension that filters `deletedAt` automatically:** rejected; invisible magic that raw SQL would bypass.
- **A separate trash table:** rejected; moving rows breaks IDs, share links and versions, and Rule 15 says to set a timestamp.
- **`node-cron` or a job queue:** rejected as extra dependencies for one hourly delete.
- **PostgreSQL row-level security for ownership and deletion:** rejected as too heavy for this scope; ownership is enforced in repositories and proven by tests.
