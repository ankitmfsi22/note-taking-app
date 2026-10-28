// PreToolUse hook for Bash. Exit code 2 blocks the call and shows stderr to Claude.
import { readFileSync } from 'node:fs';

let command = '';
try {
  command = JSON.parse(readFileSync(0, 'utf8')).tool_input?.command ?? '';
} catch {
  process.exit(0);
}

const envFileMentioned = (command.match(/\.env[\w.-]*/g) ?? []).some(
  (name) => name !== '.env.example',
);

const rules = [
  [/\bgit\s+push\b[^\n]*(\s--force\b|\s-f\b|--force-with-lease)/, 'Force-push is not allowed.'],
  [/\bgit\s+push\b[^\n]*\b(main|master)\b/, 'Never push to main.'],
  [/--no-verify\b/, 'Hooks must not be bypassed (Rule 13).'],
  [/@latest\b/, 'Never use @latest (Rule 20). Pin an exact version.'],
  [
    /\btee\b|\bsed\s+-[a-zA-Z]*i|\bperl\s+-[a-zA-Z]*i/,
    'Do not write files through the shell (Rule 10). Use the Write or Edit tool.',
  ],
  [
    /\b(echo|printf|cat)\b[^\n|;&]*[^>&\d=-]>{1,2}\s*(?!\/dev\/null)[^\s&>]/,
    'Do not write files through the shell (Rule 10). Use the Write or Edit tool.',
  ],
];

for (const [pattern, message] of rules) {
  if (pattern.test(command)) {
    console.error(`Blocked by .claude/hooks/guard-bash.mjs: ${message}`);
    process.exit(2);
  }
}

if (envFileMentioned) {
  console.error(
    'Blocked by .claude/hooks/guard-bash.mjs: do not read or print .env files. Use .env.example.',
  );
  process.exit(2);
}
