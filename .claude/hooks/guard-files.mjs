// PreToolUse hook for Write and Edit. Exit code 2 blocks the call and shows stderr to Claude.
import { readFileSync } from 'node:fs';

let path = '';
try {
  path = (JSON.parse(readFileSync(0, 'utf8')).tool_input?.file_path ?? '').replaceAll('\\', '/');
} catch {
  process.exit(0);
}

const name = path.split('/').pop() ?? '';

const rules = [
  [
    name.startsWith('.env') && name !== '.env.example',
    'Never write .env files. Edit .env.example instead.',
  ],
  [path.includes('/docs/reference/'), 'docs/reference is the read-only source material.'],
  [
    path.includes('/openspec/specs/') && name !== '.gitkeep',
    'openspec/specs changes only through `pnpm exec openspec archive` (Rule 18).',
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
