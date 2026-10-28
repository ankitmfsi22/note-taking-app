---
description: Write the OpenSpec proposal, delta spec and delta-openapi.yaml for a ticket, then stop for human review
argument-hint: AB-xxxx
allowed-tools: Read, Write, Edit, Grep, Glob, Bash(pnpm exec openspec:*), Bash(pnpm check:scenarios:*), mcp__context7__resolve-library-id, mcp__context7__query-docs
---

Write the spec for ticket $ARGUMENTS. This is Rule 1. Write no production code.

1. Check the argument is `AB-` plus four digits and that every earlier ticket is archived (`pnpm exec openspec list --archived`). AB-1001 has no predecessor. If a predecessor is missing, stop and say so.
2. Read the ticket's rows in `docs/FRS.md` (section 14 matrix), the matching endpoints in `docs/SDS.md` section 7, the schema in section 6, the design in section 8 and any linked ADR.
3. List the files you will write, then write each one with its own [y/n]:
   - `pnpm exec openspec new change AB-xxxx-<short-slug> --description "<one line>"` creates the folder `openspec/changes/AB-xxxx-<short-slug>/`
   - `proposal.md`: why, what, impact, out of scope, rollback
   - `specs/<capability>/spec.md`: delta with `## ADDED Requirements`; each requirement uses SHALL
   - `delta-openapi.yaml`: only this ticket's paths, copied from SDS section 7 with the exact status and error codes
4. Scenarios follow the `spec-scenario-format` skill: `#### Scenario: S-ABxxxx-nn <title>` with WHEN and THEN, numbered from 01. Cover every FRS AC and ERR ID of the ticket, plus one authorization-denied and one validation-failure scenario.
5. Verify any library API you cite with Context7. Mark anything the FRS and SDS do not decide as `[ASSUMPTION — confirm]`.
6. Run `pnpm exec openspec validate AB-xxxx-<short-slug> --strict` and fix errors.
7. Print a table of FRS IDs against scenario IDs. Any FRS ID without a scenario is a gap: say so.

STOP. Tell the user to review the spec and `delta-openapi.yaml`, then type `/approve spec AB-xxxx`. Do not start `/sdd-plan`.
