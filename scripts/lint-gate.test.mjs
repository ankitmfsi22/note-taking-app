import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Lints `code` as if it were the existing file `file`, with the flags `pnpm lint --max-warnings 0` adds.
const lint = (file, code) =>
  spawnSync(
    'pnpm',
    ['exec', 'eslint', '--max-warnings', '0', '--stdin', '--stdin-filename', file],
    {
      cwd: root,
      input: code,
      encoding: 'utf8',
    },
  );

const CONTROLLER = 'backend/src/modules/health/health.controller.ts';
const PAGE = 'frontend/src/routes/not-found.tsx';
const ENV = 'backend/src/config/env.ts';
const ZOD_SCHEMA = "import { z } from 'zod';\nexport const Schema = z.object({ a: z.string() });\n";

test('S-AB1001-15: the root lint script fails on a violation and passes on clean code', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(
    manifest.scripts.lint,
    'eslint .',
    'pnpm lint --max-warnings 0 appends its flag to eslint',
  );

  assert.notEqual(lint(CONTROLLER, "console.log('x');\nexport const f = 1;\n").status, 0);
  assert.equal(lint(CONTROLLER, 'export const f = 1;\n').status, 0);
});

test('S-AB1001-16: lint rejects a Zod schema outside packages/shared except the backend Env schema', () => {
  const inPage = lint(PAGE, ZOD_SCHEMA);
  assert.notEqual(inPage.status, 0);
  assert.match(inPage.stdout, /Rule 11/);

  assert.notEqual(lint(CONTROLLER, ZOD_SCHEMA).status, 0);
  assert.equal(lint(ENV, ZOD_SCHEMA).status, 0);
});
