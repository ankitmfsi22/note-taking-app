import { readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// The backend appends one JSON line per OTP here when NODE_ENV=test (AC-PWD-11, ADR-0004).
export const OTP_FILE = fileURLToPath(new URL('../.output/otp.jsonl', import.meta.url));

export const clearOtpFile = async (): Promise<void> => {
  await rm(OTP_FILE, { force: true });
};

// Returns the newest OTP issued to `email`, never reading console output (AC-E2E-02).
export const readLatestOtp = async (email: string): Promise<string> => {
  const text = await readFile(OTP_FILE, 'utf8');
  const records = text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as { email: string; otp: string });
  const match = records.filter((record) => record.email === email).at(-1);
  if (!match) throw new Error(`No OTP recorded for ${email}`);
  return match.otp;
};
