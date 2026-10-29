import { execFileSync } from 'node:child_process';
import { E2E_DATABASE_URL } from './env';

// noteapp_e2e starts empty (docker init script and the CI service only create it), so apply the
// Prisma migrations once per run. The tests then truncate, never migrate.
export default function globalSetup(): void {
  execFileSync('pnpm', ['--filter', 'backend', 'exec', 'prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
    stdio: 'inherit',
  });
}
