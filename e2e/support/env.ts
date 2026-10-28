// E2E runs on its own ports and database, so it never touches a running dev server or noteapp_dev.
export const BACKEND_PORT = 3100;
export const FRONTEND_PORT = 5174;

export const E2E_APP_ORIGIN = `http://localhost:${FRONTEND_PORT}`;
// Test-only values. The secret is at least 32 bytes; Argon2 is cheap so the suite stays fast.
export const E2E_JWT_ACCESS_SECRET = 'e2e-test-only-jwt-secret-not-for-real-use-0123456789';
export const E2E_ARGON2_MEMORY_KIB = 1024;
export const E2E_ARGON2_TIME_COST = 1;

export const E2E_DATABASE_URL =
  process.env['E2E_DATABASE_URL'] ??
  'postgresql://noteapp:noteapp_test_only@localhost:5433/noteapp_e2e';
