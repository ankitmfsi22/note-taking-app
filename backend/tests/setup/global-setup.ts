import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TEST_DATABASE_URL } from '../support/test-app.js';

const backendRoot = fileURLToPath(new URL('../../', import.meta.url));

// Brings noteapp_test up to date once per run. Integration tests assume the schema exists.
export default function setup(): void {
  try {
    execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      cwd: backendRoot,
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: 'pipe',
    });
  } catch (error) {
    throw new Error(
      'prisma migrate deploy failed against the test database. Is it running? Start it with `pnpm db:up`.',
      { cause: error },
    );
  }
}
