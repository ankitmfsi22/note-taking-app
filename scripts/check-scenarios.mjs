// Enforces "one test per spec scenario" (SDS 10.3): every `#### Scenario: S-ABnnnn-nn ...` in an
// OpenSpec spec has exactly one test whose title starts with the same ID, and no test cites an ID
// that has no scenario. Usage: node scripts/check-scenarios.mjs [--root <dir>]
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootFlag = process.argv.indexOf('--root');
const root = resolve(
  rootFlag > -1
    ? (process.argv[rootFlag + 1] ?? '')
    : join(dirname(fileURLToPath(import.meta.url)), '..'),
);

const SKIPPED_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git', 'generated', 'docs']);
const SCENARIO_HEADING = /^####\s+Scenario:\s*(.*)$/gm;
const SCENARIO_ID = /^(S-AB\d{4}-\d{2})\b/;
// Only plain it(...) and test(...) count. it.skip, it.only and it.todo do not, so a skipped test
// leaves its scenario uncovered.
const TEST_TITLE = /\b(?:it|test)\(\s*(['"`])(S-AB\d{4}-\d{2})\b/g;
const TEST_FILE = /\.(?:test|spec)\.(?:ts|tsx|mjs|js)$/;

const walk = (dir, accept) => {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const found = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) found.push(...walk(path, accept));
    } else if (accept(path)) {
      found.push(path);
    }
  }
  return found;
};

const specFiles = [
  ...walk(join(root, 'openspec', 'specs'), (path) => path.endsWith('spec.md')),
  ...readdirSync(join(root, 'openspec', 'changes'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'archive')
    .flatMap((entry) =>
      walk(join(root, 'openspec', 'changes', entry.name, 'specs'), (path) =>
        path.endsWith('spec.md'),
      ),
    ),
];

const errors = [];
const scenarios = new Map();

for (const file of specFiles) {
  for (const heading of readFileSync(file, 'utf8').matchAll(SCENARIO_HEADING)) {
    const id = SCENARIO_ID.exec(heading[1] ?? '')?.[1];
    const where = relative(root, file);
    if (!id) {
      errors.push(`${where}: scenario "${heading[1]}" does not start with an S-ABnnnn-nn id`);
    } else if (scenarios.has(id)) {
      errors.push(`${id}: defined twice (${scenarios.get(id)} and ${where})`);
    } else {
      scenarios.set(id, where);
    }
  }
}

const tests = new Map();
for (const file of walk(root, (path) => TEST_FILE.test(path))) {
  for (const title of readFileSync(file, 'utf8').matchAll(TEST_TITLE)) {
    const id = title[2];
    tests.set(id, [...(tests.get(id) ?? []), relative(root, file)]);
  }
}

for (const [id, where] of scenarios) {
  const files = tests.get(id) ?? [];
  if (files.length === 0) errors.push(`${id}: scenario has no test (${where})`);
  if (files.length > 1)
    errors.push(`${id}: ${files.length} tests claim this scenario (${files.join(', ')})`);
}
for (const [id, files] of tests) {
  if (!scenarios.has(id)) errors.push(`${id}: test has no scenario (${files.join(', ')})`);
}

if (errors.length > 0) {
  process.stderr.write(
    `check-scenarios failed:\n${errors.map((error) => `  - ${error}`).join('\n')}\n`,
  );
  process.exit(1);
}
process.stdout.write(`check-scenarios: ${scenarios.size} scenarios, each with exactly one test\n`);
