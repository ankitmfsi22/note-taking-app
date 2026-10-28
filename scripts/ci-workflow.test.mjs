import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workflow = readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8');

// SA-40: no tag or branch reference, only a full commit SHA with the version tag as a comment.
test('S-AB1001-29: every action in the CI workflow is pinned to a full commit SHA with its version tag in a comment', () => {
  const uses = [...workflow.matchAll(/^\s*(?:-\s+)?uses:\s*(.+)$/gm)].map(
    (match) => match[1] ?? '',
  );
  assert.ok(uses.length >= 4, 'expected the workflow to use actions');
  for (const line of uses) {
    assert.match(line, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$/, line);
  }
});

test('S-AB1001-30: the CI workflow is read-only, skips main and has the four jobs', () => {
  assert.match(workflow, /^permissions:\n {2}contents: read$/m);
  assert.match(workflow, /branches: \['feature\/\*\*'\]/);
  for (const job of ['verify', 'commits', 'security', 'e2e']) {
    assert.match(workflow, new RegExp(`^ {2}${job}:$`, 'm'), job);
  }
  assert.doesNotMatch(workflow, /git push/);
  assert.match(workflow, /postgres:16\.\d+-bookworm/);
});
