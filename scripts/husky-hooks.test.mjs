import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const preCommit = join(root, 'scripts', 'pre-commit.sh');

// Git exports GIT_DIR, GIT_INDEX_FILE and friends to hooks, as absolute paths in a linked worktree.
// A child git started with them would work on the real repository instead of the throwaway one.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
);

// Runs scripts/pre-commit.sh in a throwaway git repository whose staged files are `staged`, with a
// fake `pnpm` on the PATH that records its arguments and fails when its first argument is `failOn`.
const runPreCommit = (staged, failOn = '') => {
  const dir = mkdtempSync(join(tmpdir(), 'pre-commit-'));
  const bin = join(dir, 'bin');
  const log = join(dir, 'pnpm.log');
  mkdirSync(bin);
  writeFileSync(
    join(bin, 'pnpm'),
    `#!/bin/sh\necho "$*" >> "${log}"\n[ "$1" = "$FAIL_ON" ] && exit 1\nexit 0\n`,
  );
  chmodSync(join(bin, 'pnpm'), 0o755);

  const git = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8', env });
  git('init', '-q');
  for (const file of staged) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), 'content\n');
  }
  git('add', '--', ...staged);

  const result = spawnSync('sh', [preCommit], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...env, PATH: `${bin}:${env.PATH}`, FAIL_ON: failOn },
  });
  const calls = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : [];
  return { status: result.status, calls };
};

test('S-AB1001-17: the husky hooks run the pre-commit script and commitlint', () => {
  assert.match(readFileSync(join(root, '.husky', 'pre-commit'), 'utf8'), /scripts\/pre-commit\.sh/);
  assert.match(readFileSync(join(root, '.husky', 'commit-msg'), 'utf8'), /commitlint --edit "\$1"/);
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(manifest.scripts.prepare, 'husky');
  const hooksPath = spawnSync('git', ['config', 'core.hooksPath'], { cwd: root, encoding: 'utf8' });
  assert.equal(hooksPath.stdout.trim(), '.husky/_');
});

test('S-AB1001-18: the pre-commit hook stops the commit at the first failing check', () => {
  const failing = runPreCommit(['backend/src/example.ts'], 'lint');
  assert.notEqual(failing.status, 0);
  assert.deepEqual(failing.calls, ['typecheck', 'lint --max-warnings 0']);

  const passing = runPreCommit(['backend/src/example.ts']);
  assert.equal(passing.status, 0);
  assert.deepEqual(passing.calls, [
    'typecheck',
    'lint --max-warnings 0',
    'test',
    'test:tooling',
    'spec:validate',
  ]);
});

test('S-AB1001-19: the pre-commit hook only checks formatting when just docs, specs or .claude files are staged', () => {
  const result = runPreCommit([
    'docs/notes.md',
    'openspec/changes/example.yaml',
    '.claude/settings.json',
  ]);
  assert.equal(result.status, 0);
  assert.equal(result.calls.length, 1);
  assert.match(result.calls[0], /^exec prettier --check --no-error-on-unmatched-pattern /);
});
