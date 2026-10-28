---
description: Review a ticket against its spec, the FRS and the SDS with the read-only reviewer agent (run in a fresh terminal)
argument-hint: AB-xxxx
allowed-tools: Read, Grep, Glob, Agent, Bash(git diff:*), Bash(git log:*), Bash(git status:*), Bash(pnpm exec openspec:*), Bash(pnpm check:scenarios:*)
---

Review ticket $ARGUMENTS (Rule 16). You must not edit any file.

1. Rule 16 requires a fresh terminal with clean context. If this conversation already contains implementation work for the ticket, stop and tell the user to open a new Claude instance and run the command there.
2. Delegate to the `reviewer` agent with the ticket ID and the change folder `openspec/changes/$ARGUMENTS-*`. Wait for its report.
3. Print the report unchanged: one table with a row per FRS requirement and per spec scenario, then the verdict.

Legend: ✅ satisfied, ❌ missing, ⚠️ drifted from the spec, 🔴 security issue, 📋 FRS gap.

If every row is ✅, say: ready for `/pr $ARGUMENTS`. Otherwise list what to fix and say that `/pr` is blocked (Rule 17). Do not fix anything yourself.
