import { describe, expect, it } from 'vitest';
import { createPasswordHasher } from './hash.js';

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
