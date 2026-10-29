import { defineConfig, devices } from '@playwright/test';
import {
  BACKEND_PORT,
  E2E_APP_ORIGIN,
  E2E_ARGON2_MEMORY_KIB,
  E2E_ARGON2_TIME_COST,
  E2E_DATABASE_URL,
  E2E_JWT_ACCESS_SECRET,
  E2E_OTP_HMAC_SECRET,
  FRONTEND_PORT,
} from './support/env';

const isCi = Boolean(process.env['CI']);

export default defineConfig({
  testDir: 'tests',
  // One worker, because every test truncates the same database (SDS 10.2).
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  reporter: isCi ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      name: 'backend',
      command: 'pnpm --filter backend exec tsx src/server.ts',
      url: `http://localhost:${BACKEND_PORT}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        PORT: String(BACKEND_PORT),
        DATABASE_URL: E2E_DATABASE_URL,
        LOG_LEVEL: 'warn',
        JWT_ACCESS_SECRET: E2E_JWT_ACCESS_SECRET,
        OTP_HMAC_SECRET: E2E_OTP_HMAC_SECRET,
        APP_ORIGIN: E2E_APP_ORIGIN,
        COOKIE_SECURE: 'false',
        ARGON2_MEMORY_KIB: String(E2E_ARGON2_MEMORY_KIB),
        ARGON2_TIME_COST: String(E2E_ARGON2_TIME_COST),
      },
    },
    {
      name: 'frontend',
      command: `pnpm --filter frontend exec vite --port ${FRONTEND_PORT}`,
      url: `http://localhost:${FRONTEND_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_API_PROXY_TARGET: `http://localhost:${BACKEND_PORT}` },
    },
  ],
});
