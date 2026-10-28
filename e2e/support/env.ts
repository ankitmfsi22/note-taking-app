// E2E runs on its own ports and database, so it never touches a running dev server or noteapp_dev.
export const BACKEND_PORT = 3100;
export const FRONTEND_PORT = 5174;

export const E2E_DATABASE_URL =
  process.env['E2E_DATABASE_URL'] ??
  'postgresql://noteapp:noteapp_test_only@localhost:5433/noteapp_e2e';
