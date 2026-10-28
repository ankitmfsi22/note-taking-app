## ADDED Requirements

### Requirement: Local PostgreSQL 16 databases (AC-SETUP-02)
The repository SHALL provide `docker-compose.yml` with a development database and a test database, both on a pinned `postgres:16.x` image tag.

#### Scenario: S-AB1001-10 compose pins a PostgreSQL 16 image for the dev and test databases
- **WHEN** `docker-compose.yml` is read
- **THEN** it defines `db-dev` and `db-test`, and every image is `postgres:16.<minor>-<variant>` with an exact tag

### Requirement: Monorepo (AC-SETUP-01)
The repository SHALL be a pnpm workspace with the packages `backend`, `frontend` and `packages/shared`.

#### Scenario: S-AB1001-11 the workspace contains backend, frontend and packages/shared
- **WHEN** `pnpm-workspace.yaml` and the package manifests are read
- **THEN** the workspace lists `backend`, `frontend` and `packages/*`, and the packages are named `backend`, `frontend` and `@note-app/shared`

### Requirement: Exact versions (AC-SETUP-03, Rule 20)
Every dependency and tool version SHALL be pinned exactly. No range, `workspace` aside, and no `@latest` SHALL appear in a manifest or a script.

#### Scenario: S-AB1001-12 every version is exact
- **WHEN** the root and package manifests, `pnpm-workspace.yaml` and `.nvmrc` are read
- **THEN** every dependency version is `x.y.z` or `workspace:*`, no script uses `@latest`, `packageManager` is an exact pnpm version, `savePrefix` is empty and `.nvmrc` is an exact Node version

### Requirement: Quality gates run from the root (AC-SETUP-07, Rule 12)
`pnpm build`, `pnpm lint --max-warnings 0` and `pnpm test --coverage` SHALL run from the repository root. The build SHALL build the shared package before the packages that depend on it. Every package with tests SHALL enforce an 80% coverage threshold. The lint gate SHALL fail on a violation.

#### Scenario: S-AB1001-13 the root build builds shared before its consumers
- **WHEN** the workspace packages are run in the order the root build uses
- **THEN** every workspace dependency appears before the package that depends on it, and the root `build` script runs the packages recursively

#### Scenario: S-AB1001-14 every package with tests enforces 80% coverage
- **WHEN** the Vitest configuration of `backend`, `frontend` and `packages/shared` is read
- **THEN** each uses the v8 provider with thresholds of 80 for lines, functions, branches and statements, and its `test` script is `vitest run`

#### Scenario: S-AB1001-15 the lint gate fails on a violation and passes on clean code
- **WHEN** a backend file containing `console.log` is linted with `--max-warnings 0`
- **THEN** ESLint exits non-zero, and the same file without the violation exits zero

### Requirement: Rule 11 guard
Zod schemas and API types SHALL live in `packages/shared`. Outside it, `zod` SHALL be a type-only import, except in the backend `Env` schema (`backend/src/config/env.ts`) and in tests.

#### Scenario: S-AB1001-16 lint rejects a Zod schema outside packages/shared
- **WHEN** a Zod schema is declared in a frontend page or a backend controller
- **THEN** lint fails with a Rule 11 message, and the same code in `backend/src/config/env.ts` passes

### Requirement: Git hooks (AC-SETUP-06, Rules 13 and 14)
Husky SHALL run `scripts/pre-commit.sh` before each commit and commitlint on each commit message. The pre-commit script SHALL stop at the first failing check. A commit that changes only documentation, specs, `.claude` files or yaml and markdown files SHALL only be checked for formatting. Commit messages SHALL follow `type(scope): description AB#ticket`.

#### Scenario: S-AB1001-17 the husky hooks run the pre-commit script and commitlint
- **WHEN** `.husky/pre-commit`, `.husky/commit-msg` and `package.json` are read, and the git hooks path is queried
- **THEN** pre-commit calls `scripts/pre-commit.sh`, commit-msg calls `commitlint --edit`, `prepare` is `husky` and `core.hooksPath` is `.husky/_`

#### Scenario: S-AB1001-18 the pre-commit hook stops the commit at the first failing check
- **WHEN** a code file is staged and the lint check fails
- **THEN** the hook exits non-zero after running only the type check and the lint check, and when nothing fails it runs the type check, lint, tests, tooling tests and spec validation in that order

#### Scenario: S-AB1001-19 docs-only commits are only checked for formatting
- **WHEN** only files under `docs/`, `openspec/` and `.claude/` are staged
- **THEN** the hook runs one formatting check and nothing else

#### Scenario: S-AB1001-20 commitlint accepts a conventional message with scope and reference
- **WHEN** commitlint reads `feat(auth): add login AB#1002` (also with a body and a trailer)
- **THEN** it accepts the message

#### Scenario: S-AB1001-21 commitlint rejects a message without a scope
- **WHEN** commitlint reads `feat: add login AB#1002`
- **THEN** it rejects the message

#### Scenario: S-AB1001-22 commitlint rejects a message without an AB# reference
- **WHEN** commitlint reads `feat(auth): add login` or `feat(auth): add login #1002`
- **THEN** it rejects the message

#### Scenario: S-AB1001-23 commitlint rejects a header that is not conventional
- **WHEN** commitlint reads `added some stuff AB#1002` or a header with an upper-case type
- **THEN** it rejects the message

### Requirement: AI context, agents and MCP (AC-SETUP-04, AC-SETUP-05)
The repository SHALL contain `AGENTS.md` (under 200 lines), `CLAUDE.md` (under 100 lines, starting with `@AGENTS.md`) and a `CLAUDE.md` of under 50 lines in `backend`, `frontend` and `packages/shared`. The committed `.claude` folder SHALL contain the eight workflow commands, the `reviewer` and `test-writer` agents and the team settings. `.mcp.json` SHALL configure the Context7 server. Nothing committed SHALL contain a secret.

#### Scenario: S-AB1001-24 Context7 is configured and the committed .claude setup has no secrets
- **WHEN** `.mcp.json` and the `.claude` folder are read
- **THEN** `context7` runs `pnpm exec context7-mcp` with no `env` or `headers`, its package is pinned in `package.json`, all eight commands, both agents and the settings file exist, and no file matches a secret pattern

#### Scenario: S-AB1001-25 the context files exist within their line limits
- **WHEN** `AGENTS.md`, `CLAUDE.md` and the three layer `CLAUDE.md` files are read
- **THEN** each exists and has fewer lines than its limit, and the second line of `CLAUDE.md` is `@AGENTS.md`

### Requirement: One test per scenario (SDS 10.3)
`scripts/check-scenarios.mjs` SHALL fail when a scenario in an active spec has no test or more than one test, when two scenarios share an ID, or when a test cites an ID that has no scenario.

#### Scenario: S-AB1001-26 check-scenarios passes when every scenario has exactly one test
- **WHEN** every scenario in a spec has exactly one test whose title starts with its ID
- **THEN** the script exits zero and reports the number of scenarios

#### Scenario: S-AB1001-27 check-scenarios fails when a scenario has no test
- **WHEN** a scenario has no test
- **THEN** the script exits non-zero and names the scenario

#### Scenario: S-AB1001-28 check-scenarios fails on a duplicated or unknown reference
- **WHEN** two tests claim one scenario, or a test cites an ID that has no scenario
- **THEN** the script exits non-zero and names the ID

### Requirement: Continuous integration (SDS 11.6, SA-40)
The CI workflow SHALL run on pull requests and on pushes to `feature/**` branches only, never for `main`, with read-only token permissions and no step that pushes. It SHALL contain the jobs `verify`, `commits`, `security` and `e2e`, with PostgreSQL 16.x service containers. Every action SHALL be pinned to a full 40-character commit SHA, with its version tag in a trailing comment.

#### Scenario: S-AB1001-29 every action in the CI workflow is pinned to a full commit SHA
- **WHEN** the `uses:` lines of `.github/workflows/ci.yml` are read
- **THEN** each is `owner/repo@<40 hex characters> # vX.Y.Z`, with no tag or branch reference

#### Scenario: S-AB1001-30 the CI workflow is read-only, skips main and has the four jobs
- **WHEN** `.github/workflows/ci.yml` is read
- **THEN** the token permission is `contents: read`, the push trigger is limited to `feature/**`, the jobs `verify`, `commits`, `security` and `e2e` exist, the services use a `postgres:16.x` image, and no step runs `git push`
