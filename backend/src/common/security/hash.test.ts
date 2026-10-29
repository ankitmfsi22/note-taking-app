import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createOtpHasher, createPasswordHasher } from './hash.js';

const PARAMS = { memoryCost: 1024, timeCost: 1 };
const PASSWORD = 'correct-horse-9';

describe('password hasher', () => {
  it('produces an Argon2id hash', async () => {
    const hasher = createPasswordHasher(PARAMS);

    expect(await hasher.hash(PASSWORD)).toMatch(/^\$argon2id\$/);
  });

  it('encodes the configured memory, time and parallelism in the hash', async () => {
    const hasher = createPasswordHasher({ memoryCost: 2048, timeCost: 2 });

    expect(await hasher.hash(PASSWORD)).toContain('$m=2048,t=2,p=1$');
  });

  it('never stores the password in the hash', async () => {
    const hasher = createPasswordHasher(PARAMS);

    expect(await hasher.hash(PASSWORD)).not.toContain(PASSWORD);
  });

  it('salts every hash, so the same password hashes differently each time', async () => {
    const hasher = createPasswordHasher(PARAMS);

    expect(await hasher.hash(PASSWORD)).not.toBe(await hasher.hash(PASSWORD));
  });

  it('verifies the right password', async () => {
    const hasher = createPasswordHasher(PARAMS);

    expect(await hasher.verify(await hasher.hash(PASSWORD), PASSWORD)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hasher = createPasswordHasher(PARAMS);

    expect(await hasher.verify(await hasher.hash(PASSWORD), 'wrong-horse-9')).toBe(false);
  });

  it('verifies against the dummy hash with the configured parameters and always fails', async () => {
    const hasher = createPasswordHasher({ memoryCost: 2048, timeCost: 2 });

    expect(hasher.dummyHash).toBeUndefined();
    expect(await hasher.verifyDummy(PASSWORD)).toBe(false);
    expect(await hasher.verifyDummy('')).toBe(false);
  });

  it('computes the dummy hash lazily, once, from the same parameters', async () => {
    const hasher = createPasswordHasher({ memoryCost: 2048, timeCost: 2 });

    await hasher.verifyDummy(PASSWORD);

    expect(hasher.dummyHash).toMatch(/^\$argon2id\$v=\d+\$m=2048,t=2,p=1\$/);
    const first = hasher.dummyHash;
    await hasher.verifyDummy(PASSWORD);
    expect(hasher.dummyHash).toBe(first);
  });
});

describe('otp hasher', () => {
  const hasher = createOtpHasher({ secret: 'test-only-otp-hmac-secret-at-least-32-bytes' });
  const USER_ID = '0192b7c4-5a1e-7c3a-9d2f-3b8e6f1a4c70';
  const OTHER_USER_ID = '0192b7c4-5a1e-7c3a-9d2f-3b8e6f1a4c71';

  it('hashes to 64 hex characters that depend on the user and the OTP', () => {
    const stored = hasher.hash(USER_ID, '123456');

    expect(stored).toMatch(/^[0-9a-f]{64}$/);
    expect(stored).toBe(hasher.hash(USER_ID, '123456'));
    expect(stored).not.toBe(hasher.hash(OTHER_USER_ID, '123456'));
    expect(stored).not.toBe(hasher.hash(USER_ID, '123457'));
  });

  it('is keyed, so it differs from a bare SHA-256 of the same input', () => {
    const bare = createHash('sha256').update(`${USER_ID}:123456`).digest('hex');

    expect(hasher.hash(USER_ID, '123456')).not.toBe(bare);
  });

  it('matches the right OTP for the right user only', () => {
    const stored = hasher.hash(USER_ID, '123456');

    expect(hasher.matches(stored, USER_ID, '123456')).toBe(true);
    expect(hasher.matches(stored, USER_ID, '654321')).toBe(false);
    expect(hasher.matches(stored, OTHER_USER_ID, '123456')).toBe(false);
  });

  it('returns false instead of throwing for a stored hash of another length', () => {
    expect(hasher.matches('abc', USER_ID, '123456')).toBe(false);
  });

  it('always fails the dummy check', () => {
    expect(hasher.verifyDummy('123456')).toBe(false);
    expect(hasher.verifyDummy('')).toBe(false);
  });
});
