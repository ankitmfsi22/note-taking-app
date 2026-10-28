import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const lint = (message) =>
  spawnSync('pnpm', ['exec', 'commitlint'], { input: message, encoding: 'utf8' });

const valid = [
  'feat(auth): add login AB#1002',
  'docs(frs): add functional requirements AB#1001',
  'fix(notes): reject empty title AB#1004\n\nBody text.\n\nCo-Authored-By: Claude <noreply@anthropic.com>',
];

const invalid = [
  ['no scope', 'feat: add login AB#1002'],
  ['no AB# reference', 'feat(auth): add login'],
  ['not conventional', 'added some stuff AB#1002'],
  ['wrong reference prefix', 'feat(auth): add login #1002'],
];

for (const message of valid) {
  test(`commitlint accepts: ${message.split('\n')[0]}`, () => {
    const result = lint(message);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });
}

for (const [reason, message] of invalid) {
  test(`commitlint rejects (${reason}): ${message}`, () => {
    assert.notEqual(lint(message).status, 0);
  });
}
