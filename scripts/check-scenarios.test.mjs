import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = join(dirname(fileURLToPath(import.meta.url)), 'check-scenarios.mjs');

// Ids are assembled at runtime so this file never contains a literal scenario id of its own.
const id = (n) => `S-AB9999-${String(n).padStart(2, '0')}`;

// `scenarios` are numbers; `testFiles` is a list of files, each a list of numbers (one test each).
const fixture = ({ scenarios, testFiles }) => {
  const root = mkdtempSync(join(tmpdir(), 'check-scenarios-'));
  const specDir = join(root, 'openspec', 'changes', 'ab-9999-demo', 'specs', 'demo');
  mkdirSync(specDir, { recursive: true });
  mkdirSync(join(root, 'openspec', 'specs'), { recursive: true });
  const headings = scenarios.map(
    (n) => `#### Scenario: ${id(n)} demo\n- **WHEN** a\n- **THEN** b\n`,
  );
  writeFileSync(
    join(specDir, 'spec.md'),
    `## ADDED Requirements\n\n### Requirement: Demo\nThe system SHALL demo.\n\n${headings.join('\n')}`,
  );
  mkdirSync(join(root, 'pkg'), { recursive: true });
  testFiles.forEach((numbers, index) => {
    const body = numbers.map((n) => `it('${id(n)}: works', () => {});`).join('\n');
    writeFileSync(join(root, 'pkg', `t${index}.test.ts`), body);
  });
  return root;
};

const run = (root) => spawnSync('node', [script, '--root', root], { encoding: 'utf8' });

test('S-AB1001-26: check-scenarios passes when every scenario has exactly one test', () => {
  const result = run(fixture({ scenarios: [1, 2], testFiles: [[1], [2]] }));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /2 scenarios, each with exactly one test/);
});

test('S-AB1001-27: check-scenarios fails when a scenario has no test', () => {
  const result = run(fixture({ scenarios: [1, 2], testFiles: [[1]] }));
  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes(`${id(2)}: scenario has no test`), result.stderr);
});

test('S-AB1001-28: check-scenarios fails on a duplicated or an unknown scenario reference', () => {
  const duplicated = run(fixture({ scenarios: [1], testFiles: [[1], [1]] }));
  assert.equal(duplicated.status, 1);
  assert.ok(duplicated.stderr.includes(`${id(1)}: 2 tests claim this scenario`), duplicated.stderr);

  const unknown = run(fixture({ scenarios: [1], testFiles: [[1, 7]] }));
  assert.equal(unknown.status, 1);
  assert.ok(unknown.stderr.includes(`${id(7)}: test has no scenario`), unknown.stderr);
});
