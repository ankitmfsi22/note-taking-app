import { describe, expect, it } from 'vitest';
import { HealthResponseSchema } from './health.js';

describe('HealthResponseSchema', () => {
  it('accepts { status: "ok" }', () => {
    expect(HealthResponseSchema.safeParse({ status: 'ok' }).success).toBe(true);
  });

  it('rejects any other status', () => {
    expect(HealthResponseSchema.safeParse({ status: 'down' }).success).toBe(false);
  });

  it('rejects a missing status', () => {
    expect(HealthResponseSchema.safeParse({}).success).toBe(false);
  });
});
