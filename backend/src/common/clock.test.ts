import { describe, expect, it } from 'vitest';
import { systemClock } from './clock.js';

describe('systemClock', () => {
  it('returns the current time as a Date', () => {
    const before = Date.now();
    const now = systemClock.now();
    expect(now).toBeInstanceOf(Date);
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(Date.now());
  });
});
