import { describe, expect, it } from 'vitest';
import { createPrismaClient } from '../../../src/common/db/prisma.js';
import { TEST_DATABASE_URL } from '../../support/test-app.js';

describe('database connection', () => {
  it('S-AB1001-09: connects to PostgreSQL 16 through the Prisma pg adapter', async () => {
    const prisma = createPrismaClient(TEST_DATABASE_URL);
    try {
      const rows = await prisma.$queryRaw<{ db: string; major: string }[]>`
        SELECT current_database() AS db, split_part(current_setting('server_version'), '.', 1) AS major`;
      expect(rows[0]).toEqual({
        db: new URL(TEST_DATABASE_URL).pathname.slice(1),
        major: '16',
      });
    } finally {
      await prisma.$disconnect();
    }
  });
});
