import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

const valid = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  APP_ORIGIN: 'http://localhost:5173',
  OTP_HMAC_SECRET: 'b'.repeat(32),
};

describe('loadEnv', () => {
  it('applies the defaults', () => {
    expect(loadEnv(valid)).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL: valid.DATABASE_URL,
      LOG_LEVEL: 'info',
      JWT_ACCESS_SECRET: valid.JWT_ACCESS_SECRET,
      APP_ORIGIN: valid.APP_ORIGIN,
      OTP_HMAC_SECRET: valid.OTP_HMAC_SECRET,
      COOKIE_SECURE: false,
      ARGON2_MEMORY_KIB: 19456,
      ARGON2_TIME_COST: 2,
    });
  });

  it('S-AB1002-32: a short JWT secret fails startup', () => {
    expect(() => loadEnv({ ...valid, JWT_ACCESS_SECRET: 'a'.repeat(31) })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
    expect(loadEnv({ ...valid, JWT_ACCESS_SECRET: 'a'.repeat(32) }).JWT_ACCESS_SECRET).toHaveLength(
      32,
    );
  });

  it('S-AB1003-21: the env schema rejects OTP_TEST_FILE outside the test environment', () => {
    const withFile = { ...valid, OTP_TEST_FILE: '/tmp/otp.jsonl', COOKIE_SECURE: 'true' };
    expect(() => loadEnv({ ...withFile, NODE_ENV: 'development' })).toThrow(/OTP_TEST_FILE/);
    expect(() => loadEnv({ ...withFile, NODE_ENV: 'production' })).toThrow(/OTP_TEST_FILE/);
    expect(loadEnv({ ...withFile, NODE_ENV: 'test' }).OTP_TEST_FILE).toBe('/tmp/otp.jsonl');
  });

  it('S-AB1003-24: the env schema enforces the OTP_HMAC_SECRET rules', () => {
    const { OTP_HMAC_SECRET: _omitted, ...missing } = valid;
    expect(() => loadEnv(missing)).toThrow(/OTP_HMAC_SECRET/);
    expect(() => loadEnv({ ...valid, OTP_HMAC_SECRET: 'b'.repeat(31) })).toThrow(
      /OTP_HMAC_SECRET/,
    );
    expect(() => loadEnv({ ...valid, OTP_HMAC_SECRET: valid.JWT_ACCESS_SECRET })).toThrow(
      /OTP_HMAC_SECRET/,
    );
    expect(loadEnv({ ...valid, OTP_HMAC_SECRET: 'c'.repeat(32) }).OTP_HMAC_SECRET).toHaveLength(
      32,
    );
  });

  it('S-AB1002-10: production rejects Argon2 parameters below the minimum', () => {
    const production = { ...valid, NODE_ENV: 'production', COOKIE_SECURE: 'true' };
    expect(() => loadEnv({ ...production, ARGON2_MEMORY_KIB: '19455' })).toThrow(
      /ARGON2_MEMORY_KIB/,
    );
    expect(() => loadEnv({ ...production, ARGON2_TIME_COST: '1' })).toThrow(/ARGON2_TIME_COST/);
    const low = { ARGON2_MEMORY_KIB: '1024', ARGON2_TIME_COST: '1' };
    expect(loadEnv({ ...valid, ...low, NODE_ENV: 'test' })).toMatchObject({
      ARGON2_MEMORY_KIB: 1024,
      ARGON2_TIME_COST: 1,
    });
  });

  it('requires COOKIE_SECURE=true in production and parses it elsewhere', () => {
    expect(() => loadEnv({ ...valid, NODE_ENV: 'production' })).toThrow(/COOKIE_SECURE/);
    expect(loadEnv({ ...valid, COOKIE_SECURE: 'true' }).COOKIE_SECURE).toBe(true);
    expect(() => loadEnv({ ...valid, COOKIE_SECURE: 'yes' })).toThrow(/COOKIE_SECURE/);
  });

  it('requires APP_ORIGIN to be a URL', () => {
    expect(() => loadEnv({ ...valid, APP_ORIGIN: 'not a url' })).toThrow(/APP_ORIGIN/);
  });

  it('coerces PORT from a string', () => {
    expect(loadEnv({ ...valid, PORT: '4100' }).PORT).toBe(4100);
  });

  it('accepts the postgres:// scheme as well as postgresql://', () => {
    expect(loadEnv({ ...valid, DATABASE_URL: 'postgres://u:p@h/db' }).DATABASE_URL).toBe(
      'postgres://u:p@h/db',
    );
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rejects a DATABASE_URL that is not a PostgreSQL URL', () => {
    expect(() => loadEnv({ ...valid, DATABASE_URL: 'mysql://u:p@h/db' })).toThrow(/PostgreSQL/);
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
