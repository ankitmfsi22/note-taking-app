import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

// @testing-library/jest-dom 7.0.1 ships a Vitest augmentation declared as Assertion<T = any>, which
// cannot merge with Vitest 5's Assertion<R extends void | Promise<void>, T>. This one can.
declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- AB#1001 declaration merging
  interface Assertion<
    R extends void | Promise<void> = void,
    T = unknown,
  > extends TestingLibraryMatchers<T, R> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- AB#1001 declaration merging
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<unknown, unknown> {}
}
