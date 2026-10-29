import { access } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import pg from 'pg';
import { registerUser, uniqueEmail } from '../support/auth';
import { E2E_DATABASE_URL } from '../support/env';
import { expect, test } from '../support/fixtures';
import { OTP_FILE } from '../support/otp';

interface TestArgs {
  page: Page;
  browserName: string;
}

const countUsers = async (): Promise<number> => {
  const client = new pg.Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query<{ count: string }>('SELECT count(*) FROM "User"');
    return Number(rows[0]?.count);
  } finally {
    await client.end();
  }
};

// Each of the two tests registers a user and starts with none, in any order, so no test can
// depend on data left behind by another one (AC-E2E-04).
const startsClean = async ({ page, browserName }: Pick<TestArgs, 'page' | 'browserName'>) => {
  expect(browserName).toBe('chromium');
  expect(await countUsers()).toBe(0);
  await expect(access(OTP_FILE)).rejects.toThrow();

  await registerUser(page, uniqueEmail());
  await expect(page).toHaveURL(/\/notes/);
  expect(await countUsers()).toBe(1);
};

test('S-AB1016-05 every test starts from a clean database and runs in Chromium', startsClean);

test('a second test also starts clean although the previous one left a user', startsClean);
