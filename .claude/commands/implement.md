---
description: Implement an approved ticket phase by phase, with a build, lint and test checkpoint after each phase
argument-hint: AB-xxxx
---

Implement ticket $ARGUMENTS from its approved tasks.

1. Find the change folder `openspec/changes/<ticket>-*`, where `<ticket>` is `$ARGUMENTS` in lowercase (for `AB-1001`: `ab-1001-*`). Read `approvals.md`. If `spec`, `plan` and `tasks` are not all approved, stop. Check the current branch matches `feature/<domain>/AB-xxxx-*`; never work on `main`.
2. Read `proposal.md`, the spec, `design.md`, `tasks.md`, and the CLAUDE.md of each layer you touch.
3. Work one phase at a time, task by task:
   - Before using a library API, verify it with Context7 (Rule 9).
   - List the files first and write each with its own [y/n] (Rule 10).
   - Types and Zod schemas go in `packages/shared` only (Rule 11).
   - Tick the task in `tasks.md` when it is done.
   - Delegate a task marked `(subagent)` to a subagent. Delegate `[PARALLEL]` pairs with `/parallel`.
4. At every checkpoint run `pnpm build`, then `pnpm lint --max-warnings 0`, then `pnpm test`. Show the result. If anything fails, fix it before continuing (Rule 12).
5. Stay inside the spec. If the spec is wrong or incomplete, stop and tell the user. Do not widen scope.
6. At the end run `pnpm test --coverage`, `pnpm check:scenarios` and `pnpm spec:validate`, and print the Definition of Done checklist with real results.

Do not commit unless the user asks. STOP. Tell the user to open a **fresh terminal** and run `/sdd-review $ARGUMENTS` (Rule 16).
