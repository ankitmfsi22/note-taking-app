---
description: Run the [PARALLEL] tasks of a ticket in separate git worktrees, backend and frontend at the same time
argument-hint: AB-xxxx
---

Run the `[PARALLEL]` tasks of ticket $ARGUMENTS (Rule 7).

1. Read `openspec/changes/$ARGUMENTS-*/tasks.md` and confirm the three approvals in `approvals.md`. Collect the tasks marked `[PARALLEL]` and group them by side: `backend` and `frontend` (and `shared` only if it is independent). If a group is empty or the groups touch the same file, say so and fall back to `/implement`.
2. Shared contracts first: if the parallel work needs new schemas in `packages/shared`, finish and build them in the main worktree before starting.
3. For each side, list the worktree and branch, then ask [y/n]:
   - `git worktree add ../note-app-wt-<ticket>-<side> -b <current-branch>-<side>`
4. Launch one subagent per side in a single message, each with `isolation: "worktree"` or working inside its worktree path. Give each its task list, the spec, `design.md`, and the CLAUDE.md of its layer. Each runs its own phase checkpoints (`pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test`).
5. When both report, show the results and the two diffs. Ask [y/n] before merging each side branch into the ticket branch, then run the root checkpoints once more. Offer to remove the worktrees (ask first).

Never touch `main`. Never push.
