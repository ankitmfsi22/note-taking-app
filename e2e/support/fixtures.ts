import { test as base } from '@playwright/test';
import pg from 'pg';
import { E2E_DATABASE_URL } from './env';

const quote = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;

// Empties every table except Prisma's migration history. AB-1001 has no tables yet, so this is a
// no-op until AB-1002 adds the first migration.
export const resetDatabase = async (): Promise<void> => {
  const client = new pg.Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables
       WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
    );
    if (rows.length > 0) {
      const tables = rows.map((row) => quote(row.tablename)).join(', ');
      await client.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
    }
  } finally {
    await client.end();
  }
};

// Every test starts from a clean database and depends on no other test (AC-E2E-04).
export const test = base.extend<{ cleanDatabase: void }>({
  cleanDatabase: [
    // eslint-disable-next-line no-empty-pattern -- AB#1001 Playwright requires a destructured first argument
    async ({}, use) => {
      await resetDatabase();
      await use();
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
