import { describe, expect, it } from 'vitest';
import { daysRemaining } from './days-remaining';

const DAY = 86_400_000;
const NOW = new Date('2026-10-29T12:00:00.000Z');
const deletedDaysAgo = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();

describe('daysRemaining', () => {
  it('counts the days left of the 30-day window', () => {
    expect(daysRemaining(deletedDaysAgo(25), NOW)).toBe(5);
    expect(daysRemaining(deletedDaysAgo(0), NOW)).toBe(30);
  });

  it('rounds a part of a day up', () => {
    expect(daysRemaining(deletedDaysAgo(25.5), NOW)).toBe(5);
  });

  it('is 0 at the boundary and after it', () => {
    expect(daysRemaining(deletedDaysAgo(30), NOW)).toBe(0);
    expect(daysRemaining(deletedDaysAgo(45), NOW)).toBe(0);
  });
});
