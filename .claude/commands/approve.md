---
description: Record a human approval for a ticket gate (spec, plan or tasks)
argument-hint: spec|plan|tasks AB-xxxx
allowed-tools: Read, Write, Edit, Glob
disable-model-invocation: true
---

Record an approval. Only the user can run this command; it is the human gate of Rules 2 and 3.

Arguments: `$ARGUMENTS`, a gate (`spec`, `plan` or `tasks`) followed by a ticket ID.

1. Check the gate is one of the three and the ticket has a folder `openspec/changes/ab-xxxx-*` (lowercase ticket ID).
2. Enforce the order: `plan` needs `spec` approved, `tasks` needs `plan` approved. Read `approvals.md` in the change folder. If the previous gate is missing, stop.
3. Ask [y/n], then append one line to `approvals.md` (create the file with a `# Approvals` heading if it does not exist): `- <gate>: approved on <today's date> by <git config user.name>`.
4. Print the next command: after `spec` run `/sdd-plan AB-xxxx`, after `plan` run `/sdd-tasks AB-xxxx`, after `tasks` run `/implement AB-xxxx`.

If the user wants changes instead of approving, do not write anything. Ask what to change.
