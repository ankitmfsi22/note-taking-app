---
description: Write tasks.md for a ticket from its design, then continue to /implement
argument-hint: AB-xxxx
allowed-tools: Read, Write, Edit, Grep, Glob, Bash(pnpm exec openspec:*)
---

Write the task list for ticket $ARGUMENTS. This is Rule 3. Write no production code.

1. Find the change folder `openspec/changes/<ticket>-*`, where `<ticket>` is `$ARGUMENTS` in lowercase (for `AB-1001`: `ab-1001-*`). Read `approvals.md`. If it has no line for `spec`, or `design.md` is missing, stop and say so.
2. Read the approved spec and `design.md`.
3. List the file you will write, then write a short `tasks.md` (the tool permission prompt is the confirmation):
   - A checklist `- [ ] 1.1 ...` grouped into phases. Each phase ends with a checkpoint task: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`.
   - Each task names its files and an estimate in minutes. A task over 45 minutes is marked `(subagent)` (Rule 6).
   - Tasks that touch disjoint files, for example backend against frontend, are marked `[PARALLEL]` (Rule 7).
   - Each scenario has exactly one test task named with its `S-ABxxxx-nn` ID.
   - The last phase: `pnpm test --coverage` at 80% or more on new code, `pnpm check:scenarios`, `pnpm spec:validate`, manual smoke test of the happy path and every error scenario, and a reminder to run `/sdd-review` in a fresh terminal.
4. Every spec requirement and every scenario must map to at least one task. Say so in a closing table.

There is no tasks gate (two-gate flow: spec and PR). Continue straight to `/implement $ARGUMENTS`.
