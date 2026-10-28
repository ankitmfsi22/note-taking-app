// PreToolUse hook for Write and Edit. Exit code 2 blocks the call and shows stderr to Claude.
import { readFileSync } from 'node:fs';

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

const path = (input.tool_input?.file_path ?? '').replaceAll('\\', '/');
const name = path.split('/').pop() ?? '';

// `openspec archive` writes a placeholder Purpose into every new spec, and `openspec validate
// --strict` rejects it. Replacing exactly that placeholder is the one allowed edit under
// openspec/specs. Everything else there changes only through an archive.
const PURPOSE_PLACEHOLDER = 'TBD - created by archiving change';
const isPurposeFix =
  input.tool_name === 'Edit' &&
  String(input.tool_input?.old_string ?? '').startsWith(PURPOSE_PLACEHOLDER) &&
  !String(input.tool_input?.new_string ?? '').includes('TBD');

const rules = [
  [
    name.startsWith('.env') && name !== '.env.example',
    'Never write .env files. Edit .env.example instead.',
  ],
  [path.includes('/docs/reference/'), 'docs/reference is the read-only source material.'],
  [
    path.includes('/openspec/specs/') && name !== '.gitkeep' && !isPurposeFix,
    'openspec/specs changes only through `pnpm exec openspec archive` (Rule 18). The only direct edit allowed is replacing the archive placeholder Purpose.',
  ],
  [path.includes('/src/generated/'), 'Generated code. Re-run the generator instead of editing.'],
  [path.endsWith('/pnpm-lock.yaml'), 'pnpm-lock.yaml is managed by pnpm.'],
];

for (const [blocked, message] of rules) {
  if (blocked) {
    console.error(`Blocked by .claude/hooks/guard-files.mjs: ${message}`);
    process.exit(2);
  }
}
