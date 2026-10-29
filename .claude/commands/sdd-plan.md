---
description: Write design.md for a ticket from its approved spec, then continue to /sdd-tasks
argument-hint: AB-xxxx
allowed-tools: Read, Write, Edit, Grep, Glob, Bash(pnpm exec openspec:*), mcp__context7__resolve-library-id, mcp__context7__query-docs
---

Write the technical plan for ticket $ARGUMENTS. This is Rule 3. Write no production code.

1. Find the change folder `openspec/changes/<ticket>-*`, where `<ticket>` is `$ARGUMENTS` in lowercase (for `AB-1001`: `ab-1001-*`). Read its `approvals.md`. If it has no line for `spec`, stop and tell the user to approve the spec first (Rule 2).
2. Read the approved spec, `delta-openapi.yaml`, and the relevant parts of `docs/SDS.md` and ADRs.
3. List the file you will write, then write a short `design.md` (the tool permission prompt is the confirmation). Contents:
   - files to create or change, per layer (shared, backend module, migration, frontend feature)
   - the Prisma migration, if any, and the order of steps
   - how each spec requirement maps to code
   - risks and how the tests cover them
4. Follow the SDS. Where the SDS is silent, choose the simplest option and mark it `[ASSUMPTION — confirm]`. A change to a binding SDS code, schema or endpoint is not allowed here; flag it for a separate SDS update.
5. Verify library APIs with Context7.

There is no plan gate (two-gate flow: spec and PR). Continue straight to `/sdd-tasks $ARGUMENTS`.
