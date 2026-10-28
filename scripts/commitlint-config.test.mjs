import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const lint = (message) =>
  spawnSync('pnpm', ['exec', 'commitlint'], { input: message, encoding: 'utf8' });

const accepted = (message) => assert.equal(lint(message).status, 0, `should accept: ${message}`);
const rejected = (message) => assert.notEqual(lint(message).status, 0, `should reject: ${message}`);

test('S-AB1001-20: commitlint accepts a conventional message with a scope and an AB# reference', () => {
  accepted('feat(auth): add login AB#1002');
  accepted('docs(frs): add functional requirements AB#1001');
  accepted(
    'fix(notes): reject empty title AB#1004\n\nBody text.\n\nCo-Authored-By: Claude <noreply@anthropic.com>',
  );
});

test('S-AB1001-21: commitlint rejects a message without a scope', () => {
  rejected('feat: add login AB#1002');
});

test('S-AB1001-22: commitlint rejects a message without an AB# reference', () => {
  rejected('feat(auth): add login');
  rejected('feat(auth): add login #1002');
});

test('S-AB1001-23: commitlint rejects a header that is not in conventional format', () => {
  rejected('added some stuff AB#1002');
  rejected('Feat(auth): Add login. AB#1002');
});
