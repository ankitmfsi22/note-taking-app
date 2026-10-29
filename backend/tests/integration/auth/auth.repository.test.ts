import { describe, expect, it } from 'vitest';
import { createAuthRepository } from '../../../src/modules/auth/auth.repository.js';
import { useTestDatabase } from '../../support/db.js';

const prisma = useTestDatabase();

const newUser = (email: string) => ({ email, passwordHash: 'hash', displayName: null });

describe('auth repository createUser', () => {
  it('returns the created user', async () => {
    const repository = createAuthRepository(prisma);

    const user = await repository.createUser(newUser('ada@example.com'));

    expect(user?.email).toBe('ada@example.com');
    expect(await prisma.user.count()).toBe(1);
  });

  it('returns null instead of throwing when the email is already taken', async () => {
    const repository = createAuthRepository(prisma);
    await repository.createUser(newUser('ada@example.com'));

    const duplicate = await repository.createUser(newUser('ada@example.com'));

    expect(duplicate).toBeNull();
    expect(await prisma.user.count()).toBe(1);
  });

  it('rethrows a database error that is not a unique violation', async () => {
    const repository = createAuthRepository(prisma);
    const tooLong = `${'a'.repeat(300)}@example.com`;

    await expect(repository.createUser(newUser(tooLong))).rejects.toBeInstanceOf(Error);
    expect(await prisma.user.count()).toBe(0);
  });
});
