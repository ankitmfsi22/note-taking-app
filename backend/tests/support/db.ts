import pg from 'pg';
import { afterAll, beforeEach } from 'vitest';
import { createPrismaClient } from '../../src/common/db/prisma.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { TEST_DATABASE_URL } from './test-app.js';

const quote = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;

// Empties every table except Prisma's migration history.
const truncateAll = async (): Promise<void> => {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
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

// Call once at the top of an integration test file. Every test then starts on empty tables.
export const useTestDatabase = (): PrismaClient => {
  const prisma = createPrismaClient(TEST_DATABASE_URL);
  beforeEach(truncateAll);
  afterAll(() => prisma.$disconnect());
  return prisma;
};
