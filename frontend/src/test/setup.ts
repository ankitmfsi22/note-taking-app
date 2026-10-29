import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, expect } from 'vitest';
import { useAuthStore } from '@/features/auth/session-store';
import { server } from './server';

// jest-dom's own '/vitest' entry has typings for Vitest 2 and clashes with Vitest 5 (see jest-dom.d.ts).
expect.extend(matchers);

// findBy and waitFor default to 1 s, which cold lazy imports and coverage can exceed.
configure({ asyncUtilTimeout: 15_000 });

// Vitest globals are off, so Testing Library cannot register its own cleanup.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  useAuthStore.setState(useAuthStore.getInitialState(), true);
});
afterAll(() => server.close());
