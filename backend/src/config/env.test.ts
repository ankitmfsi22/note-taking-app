import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

const valid = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db' };

describe('loadEnv', () => {
  it('applies the defaults', () => {
    expect(loadEnv(valid)).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL: valid.DATABASE_URL,
      LOG_LEVEL: 'info',
    });
  });

  it('coerces PORT from a string', () => {
    expect(loadEnv({ ...valid, PORT: '4100' }).PORT).toBe(4100);
  });

  it('accepts the postgres:// scheme as well as postgresql://', () => {
    expect(loadEnv({ DATABASE_URL: 'postgres://u:p@h/db' }).DATABASE_URL).toBe(
      'postgres://u:p@h/db',
    );
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rejects a DATABASE_URL that is not a PostgreSQL URL', () => {
    expect(() => loadEnv({ DATABASE_URL: 'mysql://u:p@h/db' })).toThrow(/PostgreSQL/);
  });

  it('rejects an out-of-range PORT', () => {
    expect(() => loadEnv({ ...valid, PORT: '70000' })).toThrow(/PORT/);
  });

  it('rejects an unknown NODE_ENV and an unknown LOG_LEVEL', () => {
    expect(() => loadEnv({ ...valid, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
    expect(() => loadEnv({ ...valid, LOG_LEVEL: 'loud' })).toThrow(/LOG_LEVEL/);
  });

  it('lists every failing variable in one message', () => {
    expect(() => loadEnv({ PORT: '0', NODE_ENV: 'x' })).toThrow(
      /DATABASE_URL[\s\S]*PORT|PORT[\s\S]*DATABASE_URL/,
    );
  });
});
