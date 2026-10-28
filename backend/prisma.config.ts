import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: new URL('../.env', import.meta.url), quiet: true });

// env() would throw during `prisma generate` on a fresh clone or in CI, where no database is
// configured. Only the db and migrate commands need the URL.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
