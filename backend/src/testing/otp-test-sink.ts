// Test-only (ADR-0004, AC-PWD-11). server.ts imports this module only when NODE_ENV is test, and
// the Env schema rejects OTP_TEST_FILE anywhere else. Nothing else may import it.
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Clock } from '../common/clock.js';
import type { OtpSink } from '../modules/email/email.service.js';

// The repository-root e2e/.output/otp.jsonl, from both src/testing and dist/testing.
const DEFAULT_FILE = fileURLToPath(new URL('../../../e2e/.output/otp.jsonl', import.meta.url));

export const createOtpTestSink = ({
  filePath = DEFAULT_FILE,
  clock,
}: {
  filePath?: string | undefined;
  clock: Clock;
}): OtpSink => {
  return async ({ email, otp }) => {
    await mkdir(dirname(filePath), { recursive: true });
    const record = { email, otp, issuedAt: clock.now().toISOString() };
    await appendFile(filePath, `${JSON.stringify(record)}\n`, { mode: 0o600 });
  };
};
