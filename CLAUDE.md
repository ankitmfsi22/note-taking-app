# CLAUDE.md
@AGENTS.md

## Workflow (SDD, strict order, one ticket per session)

- No production code without an approved OpenSpec change. Typos, dependency bumps and small fixes may skip the spec.
- Human gates: spec (Rule 2), plan and tasks (Rule 3), each recorded by the user with `/approve` in the change's `approvals.md`; then the PR review. Never skip or auto-approve a gate.
- Gates follow the SDD guide (spec + PR) due to deadline.
- Run `/clear` between tickets (Rule 4). Run `/compact` at about 70% context (Rule 5).
- Tasks over about 45 minutes go to a subagent. Never use a `session-context.md` file as a workaround (Rule 6).
- Tasks marked `[PARALLEL]` use git worktrees via `/parallel`. Frontend and backend work run in separate worktrees at the same time (Rule 7).
- Models (Rule 8): Haiku for boilerplate, Sonnet for implementation, Opus with ultrathink for architecture only.
- Context7 stays active. Verify every library API against live docs (Rule 9).
- Ask `[y/n]` before every file write. List the files before each step (Rule 10). Never write files through shell commands.

## Custom commands

`/plan`, `/tasks` and `/review` are Claude Code built-ins, so ours use an `sdd-` prefix where needed. The openspec CLI is wrapped, never replaced (`pnpm exec openspec`, initialised with `--tools none`, so there are no `/opsx:*` commands).

| Command | Purpose | Assignment name |
| --- | --- | --- |
| `/spec AB-xxxx` | Write the OpenSpec proposal, delta spec and `delta-openapi.yaml`; STOP for review | `/spec` |
| `/sdd-plan AB-xxxx` | Write `design.md` from the approved spec; STOP for review | `/plan` |
| `/sdd-tasks AB-xxxx` | Write `tasks.md` with `[PARALLEL]` markers; STOP for review | `/tasks` |
| `/implement AB-xxxx` | Implement the approved tasks phase by phase with checkpoints | `/implement` |
| `/parallel AB-xxxx` | Run `[PARALLEL]` tasks in separate git worktrees | `/parallel` |
| `/sdd-review AB-xxxx` | Read-only `reviewer` agent in a fresh terminal: spec + FRS compliance | `/review` |
| `/pr AB-xxxx` | Archive the change, then open the PR (only after all-green review) | `/pr` |
| `/approve` | Record a human approval for the current gate | `/approve` |

## Quality gates

- After every phase checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`. Never continue past a failing checkpoint (Rule 12).
- `/sdd-review` runs in a fresh terminal (new Claude instance, clean context, read-only `reviewer` agent). `/pr` is allowed only when it shows all ✅: no ❌ missing, ⚠️ drifted, 🔴 security or 📋 FRS gap (Rules 16 and 17).
- Definition of done: `pnpm spec:validate`, `/sdd-review` all ✅, build/lint clean, `pnpm test --coverage` at least 80% on new code, one named test per scenario, error codes match SDS section 7, `openspec archive` done, PR checklist ticked.
- Every PR description lists each FRS requirement covered and each spec scenario tested (Rule 19).

## Commits and branches

- Commit: `type(scope): description AB#ticket`, for example `feat(auth): add login AB#1002`. Scope and `AB#` are required (Rule 14).
- Branch: `feature/{domain}/AB-{ticket}-{short-name}`.
- Never commit with failing tests, lint or type errors (Rule 13). The Husky pre-commit hook and commitlint enforce Rules 13 and 14. Ask before any commit.
- End commit messages with the attribution line given in the session reminder.

## Where to look

- Endpoint, status and error codes: SDS section 7. Schema: section 6. Error policy: section 4.
- Per-layer rules: `backend/CLAUDE.md`, `frontend/CLAUDE.md`, `packages/shared/CLAUDE.md`.

## Never

- Push to `main`, force-push, or use `--no-verify`.
- Read or print `.env` files or secrets.
- Use `@latest` or a version range in an install command or `package.json`.
- Run with `--dangerously-skip-permissions` outside a sandbox.
- Change a binding SDS error code or endpoint without an approved spec and an SDS update.
