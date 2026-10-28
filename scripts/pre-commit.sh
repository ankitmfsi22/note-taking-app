#!/bin/sh
# Pre-commit gate (Rule 13). A commit that only touches docs, specs, .claude or yaml/md files
# skips the heavy checks.
set -eu

staged=$(git diff --cached --name-only --diff-filter=ACMR)
[ -n "$staged" ] || exit 0

heavy=0
for file in $staged; do
  case "$file" in
    docs/* | openspec/* | .claude/* | *.md | *.yaml | *.yml) ;;
    *) heavy=1 ;;
  esac
done

if [ "$heavy" -eq 0 ]; then
  # shellcheck disable=SC2086
  pnpm exec prettier --check --no-error-on-unmatched-pattern $staged
  exit 0
fi

pnpm typecheck
pnpm lint --max-warnings 0
pnpm test
pnpm test:tooling
pnpm spec:validate
