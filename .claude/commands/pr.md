---
description: Archive the OpenSpec change, then open the pull request for a ticket (only after an all-green review)
argument-hint: AB-xxxx
disable-model-invocation: true
---

Raise the PR for ticket $ARGUMENTS. Only the user can run this command.

1. Ask the user to confirm that `/sdd-review $ARGUMENTS` was run in a fresh terminal and showed all ✅ (Rules 16 and 17). If not, stop.
2. Verify on the ticket branch `feature/<domain>/AB-xxxx-*`, never `main`, with a clean working tree. Run `pnpm build`, `pnpm lint --max-warnings 0` and `pnpm test --coverage`. Stop on any failure.
3. Rule 18, before the PR: ask [y/n], then run `pnpm exec openspec archive <change-name> --yes`. Check the change is now under `openspec/changes/archive/`.
   Then always merge the ticket's `delta-openapi.yaml` (from the archived change folder) into `docs/api/openapi.yaml`:
   - add the delta's `paths` and any `components` (schemas, responses, parameters, securitySchemes) that are missing; never duplicate or silently overwrite an existing one, report conflicts and stop
   - update the `info` summary to reflect the new endpoints
   - run `pnpm exec prettier --check docs/api/openapi.yaml` (fix with `--write` if needed)
   - confirm it parses as YAML and that every `$ref` resolves
   - run `pnpm spec:validate` and `pnpm check:scenarios`
4. Ask [y/n] before committing the archive and the merge together, in one commit: `chore(spec): archive <change-name> and merge its openapi delta AB#xxxx`.
5. Compose the PR description (Rule 19): summary, every FRS requirement covered (IDs), every spec scenario tested (`S-ABxxxx-nn` with its test file), the Definition of Done checklist ticked with real results, and the `/sdd-review` verdict. End with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
6. Push the branch (`/implement` usually already has), then ask [y/n] before `gh pr create`. Never push to `main`.

Print the PR link. STOP: the human PR review is the final gate.
