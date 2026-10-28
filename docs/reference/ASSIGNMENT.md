# Assignment: Note Taking App

**Claude Code · Spec-Driven Development**

---

## Problem Statement

Build a full-stack **Note Taking Application** where authenticated users can create, organize, search, and share notes. The app must include standard CRUD operations, a tagging system, full-text search, shareable public links, and version history per note.

This is not just a coding exercise — it is a **workflow exercise**. You will be evaluated on *how* you build, not just *what* you build. Every ticket must follow the complete SDD cycle before a single line of code is written.

---

## Tech Stack (Fixed — No Substitutions)

| Layer | Technology |
| --- | --- |
| Frontend | React 19 + TypeScript + Vite + TanStack Query + Zustand + TipTap + shadcn/ui |
| Backend | Node.js 22 + Express 5 + TypeScript |
| Database | PostgreSQL 16 + Prisma ORM |
| Auth | JWT access token (15 min) + refresh token (7 days, stored in DB) |
| Search | PostgreSQL Full-Text Search — no external service |
| Testing | Vitest + Supertest + Playwright |
| Monorepo | pnpm workspaces |

---

## Features to Build

1. **Auth** — Register, login, logout, forgot/reset password via OTP
2. **Notes CRUD** — Create, read, update, soft-delete with pagination, sorting, tag filters
3. **Tags** — User-scoped tags with note counts, color support
4. **Search** — Full-text search with keyword highlighting in results
5. **Sharing** — Generate/revoke public read-only links with expiry and view count
6. **Version History** — Snapshot per save, view any version, restore as new version

---

## What Is Out of Scope

Do not build these — any attempt is a violation:

- Real-time collaborative editing
- File or image attachments
- Mobile app
- OAuth / social login
- Note folders or nesting
- Actual email sending (log to console only)

---

## Ticket Sequence

Build strictly in this order — no skipping, no reordering:

```text
AB-1001  Project setup — monorepo, Prisma, CLAUDE.md files, agents, skills, MCPs
AB-1002  Auth — register, login, logout, JWT + refresh token
AB-1003  Auth — forgot password + OTP reset
AB-1004  Notes — full CRUD + soft delete
AB-1005  Notes — pagination, sorting, tag filtering
AB-1006  Tags — CRUD + note count per tag
AB-1007  Search — full-text with highlight + pagination
AB-1008  Sharing — generate link, revoke, public access, atomic view count
AB-1009  Version history — snapshot, list, view, restore, auto-purge
AB-1010  Frontend — Auth pages
AB-1011  Frontend — Notes list page
AB-1012  Frontend — Note editor with TipTap + autosave
AB-1013  Frontend — Search UI with highlights
AB-1014  Frontend — Share modal + active links
AB-1015  Frontend — Version history drawer + restore
AB-1016  E2E — Playwright full user journey
```

---

## Non-Negotiable Workflow Rules

### Before Writing Any Code

- **Rule 1** — Every ticket must have a written spec proposal before any implementation. Use `/spec AB-xxxx`. No exceptions.
- **Rule 2** — The spec delta (`delta-openapi.yaml`) must be human-reviewed and approved before moving to `/plan`.
- **Rule 3** — `/plan` must be reviewed and approved before `/tasks`. `/tasks` must be approved before `/implement`.

### During Implementation

- **Rule 4** — One ticket per Claude session. Run `/clear` between tickets — no exceptions.
- **Rule 5** — Run `/compact` when context usage hits ~70%. Never wait for context to fill.
- **Rule 6** — For tasks estimated >45 minutes, delegate to a subagent. Never use `session-context.md` as a workaround.
- **Rule 7** — Use git worktrees (`/parallel`) for any two tasks marked `[PARALLEL]` in `tasks.md`. Frontend and backend work must run in separate worktrees simultaneously.
- **Rule 8** — Use the right model for the right task: Haiku for boilerplate, Sonnet for implementation, Opus+ultrathink for architecture decisions only.
- **Rule 9** — Context7 MCP must be active at all times. Every library API call must be verified against live docs — no hallucinated methods allowed.
- **Rule 10** — Ask `[y/n]` before every file write. Never let Claude write files silently.

### Code Quality

- **Rule 11** — All TypeScript types and Zod schemas live in `packages/shared` only. Never duplicate in frontend or backend.
- **Rule 12** — After every phase checkpoint: `pnpm build` (0 errors) → `pnpm lint --max-warnings 0` → `pnpm test` (all green). Never proceed past a failing checkpoint.
- **Rule 13** — Never commit with failing tests, lint errors, or TypeScript errors. Husky pre-commit hook enforces this.
- **Rule 14** — All commits must follow conventional format: `feat(scope): description AB#ticket`. commitlint enforces this.
- **Rule 15** — Soft delete means setting `deletedAt` timestamp only. Never physically delete note rows within the 30-day recovery window.

### Before Raising a PR

- **Rule 16** — Run `/review AB-xxxx` in a **fresh terminal** (new Claude instance, clean context). The `reviewer` agent is read-only — it only checks spec + FRS compliance.
- **Rule 17** — The `/review` output must show **all ✅** — no ❌ (missing), no ⚠️ (drifted), no 🔴 (security), no 📋 (FRS gap) — before running `/pr`.
- **Rule 18** — Run `openspec archive AB-xxxx` before raising the PR. The change must move from `changes/` to `archive/`.
- **Rule 19** — PR description must list every FRS requirement covered and every spec scenario tested.
- **Rule 20** — Pin all tool versions in `package.json`. Never use `@latest` in install commands.

---

## Definition of Done (Per Ticket)

A ticket is complete **only** when all of these are true:

- `openspec validate` passes — implementation matches approved delta spec
- `/review` agent shows all ✅ in a fresh terminal
- `pnpm build` — 0 errors, 0 warnings
- `pnpm lint --max-warnings 0` — clean
- `pnpm test --coverage` — all green, ≥80% coverage on new code
- Every spec scenario has exactly one named test
- All error HTTP status codes match the SDS API contracts exactly
- Happy path + all error scenarios manually smoke tested
- `openspec archive` completed
- PR checklist fully ticked, conventional commit linked to ticket
