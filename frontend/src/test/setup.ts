import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, expect } from 'vitest';
import { server } from './server';

// jest-dom's own '/vitest' entry has typings for Vitest 2 and clashes with Vitest 5 (see jest-dom.d.ts).
expect.extend(matchers);

// Vitest globals are off, so Testing Library cannot register its own cleanup.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
