---
description: Record the human spec approval for a ticket
argument-hint: spec AB-xxxx
allowed-tools: Read, Write, Edit, Glob
disable-model-invocation: true
---

Record an approval. Only the user can run this command. Gates follow the SDD guide: spec approval here, then the PR merge; plan and tasks have no gate.

Arguments: `$ARGUMENTS`, the gate `spec` followed by a ticket ID.

1. Check the gate is `spec` and the ticket has a folder `openspec/changes/ab-xxxx-*` (lowercase ticket ID).
2. Append one line to `approvals.md` (create the file with a `# Approvals` heading if it does not exist): `- spec: approved on <today's date> by <git config user.name>`.
3. Print the next command: `/sdd-plan AB-xxxx`, which goes straight through design, tasks and implement.

If the user wants changes instead of approving, do not write anything. Ask what to change.
