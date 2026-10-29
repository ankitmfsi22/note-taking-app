import { describe, expect, it } from 'vitest';
import { AppError } from '../../common/errors/app-error.js';
import type { PasswordHasher } from '../../common/security/hash.js';
import { generateRefreshToken, hashRefreshToken } from '../../common/security/tokens.js';
import type { AuthRepository } from './auth.repository.js';
import { createAuthService } from './auth.service.js';

type TokenRow = NonNullable<Awaited<ReturnType<AuthRepository['findRefreshTokenByHash']>>>;
type UserRow = TokenRow['user'];

const START = new Date('2026-01-01T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

const user: UserRow = {
  id: 'user-1',
  email: 'ada@example.com',
  passwordHash: 'hash',
  displayName: 'Ada',
  createdAt: START,
  updatedAt: START,
};

const setup = () => {
  let current = new Date(START);
  const clock = { now: () => new Date(current) };
  const advanceMs = (ms: number) => {
    current = new Date(current.getTime() + ms);
  };

  const rows: TokenRow[] = [];
  const calls: string[] = [];
  let rotateResult: number | undefined;
  // What the re-read after a lost compare-and-set returns instead of the stored row.
  let rereadOverride: { row: TokenRow | null } | undefined;
  let lookups = 0;

  const addRow = (overrides: Partial<TokenRow> = {}) => {
    const raw = generateRefreshToken();
    rows.push({
      id: `row-${rows.length + 1}`,
      userId: user.id,
      tokenHash: hashRefreshToken(raw),
      expiresAt: new Date(current.getTime() + 7 * DAY_MS),
      revokedAt: null,
      rotatedAt: null,
      createdAt: current,
      user,
      ...overrides,
    });
    return { raw, row: rows[rows.length - 1] as TokenRow };
  };

  const methods = {
    findUserByEmail: () => Promise.resolve(user),
    createUser: () => Promise.resolve(user),
    createRefreshToken: (data: { userId: string; tokenHash: string; expiresAt: Date }) => {
      calls.push('createRefreshToken');
      const row: TokenRow = {
        id: `row-${rows.length + 1}`,
        ...data,
        revokedAt: null,
        rotatedAt: null,
        createdAt: current,
        user,
      };
      rows.push(row);
      return Promise.resolve(row);
    },
    findRefreshTokenByHash: (tokenHash: string) => {
      lookups += 1;
      calls.push('findRefreshTokenByHash');
      if (lookups > 1 && rereadOverride) return Promise.resolve(rereadOverride.row);
      return Promise.resolve(rows.find((r) => r.tokenHash === tokenHash) ?? null);
    },
    rotateRefreshToken: (id: string, now: Date) => {
      calls.push('rotateRefreshToken');
      if (rotateResult !== undefined) return Promise.resolve(rotateResult);
      const row = rows.find((r) => r.id === id && r.revokedAt === null);
      if (!row) return Promise.resolve(0);
      row.revokedAt = now;
      row.rotatedAt = now;
      return Promise.resolve(1);
    },
    revokeActiveToken: () => Promise.resolve(0),
    revokeAllActiveForUser: (userId: string, now: Date) => {
      calls.push('revokeAllActiveForUser');
      const active = rows.filter((r) => r.userId === userId && r.revokedAt === null);
      active.forEach((r) => {
        r.revokedAt = now;
      });
      return Promise.resolve(active.length);
    },
  };

  const fake = {
    ...methods,
    transaction: async <T>(fn: (tx: typeof methods) => Promise<T>): Promise<T> => {
      try {
        const result = await fn(methods);
        calls.push('commit');
        return result;
      } catch (error) {
        calls.push('rollback');
        throw error;
      }
    },
  };

  // The fake returns plain promises where Prisma returns PrismaPromise, so only this boundary is cast.
  const repository = fake as unknown as AuthRepository;
  // The refresh path never hashes a password.
  const passwordHasher = {} as PasswordHasher;
  const service = createAuthService({
    repository,
    clock,
    passwordHasher,
    accessTokenSecret: 'unit-test-secret-unit-test-secret',
  });

  return {
    service,
    rows,
    calls,
    advanceMs,
    addRow,
    setRotateResult: (value: number) => {
      rotateResult = value;
    },
    setReread: (row: TokenRow | null) => {
      rereadOverride = { row };
    },
  };
};

const rejection = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  return undefined;
};

const expectInvalid = async (promise: Promise<unknown>) => {
  const error = await rejection(promise);
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe('INVALID_REFRESH_TOKEN');
};

describe('auth service refresh', () => {
  it('rotates a valid token and returns a new one', async () => {
    const { service, rows, calls, addRow } = setup();
    const { raw, row } = addRow();

    const result = await service.refresh(raw);

    expect(result.refreshToken).not.toBe(raw);
    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.user).toEqual({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: START.toISOString(),
    });
    expect(calls.filter((c) => c === 'rotateRefreshToken')).toHaveLength(1);
    expect(calls.filter((c) => c === 'createRefreshToken')).toHaveLength(1);
    expect(row.rotatedAt).not.toBeNull();
    expect(rows).toHaveLength(2);
    expect(rows[1]?.tokenHash).toBe(hashRefreshToken(result.refreshToken));
    expect(calls).not.toContain('revokeAllActiveForUser');
    expect(calls.at(-1)).toBe('commit');
  });

  it('rejects an unknown token without revoking anything', async () => {
    const { service, calls, addRow } = setup();
    addRow();

    await expectInvalid(service.refresh(generateRefreshToken()));

    expect(calls).not.toContain('revokeAllActiveForUser');
    expect(calls).not.toContain('rotateRefreshToken');
  });

  it('treats a missing token like an unknown one', async () => {
    const { service, calls, addRow } = setup();
    addRow();

    await expectInvalid(service.refresh(undefined));

    expect(calls).not.toContain('revokeAllActiveForUser');
    expect(calls).not.toContain('rotateRefreshToken');
  });

  it('revokes the whole family on reuse of a rotated token, committed before the error', async () => {
    const { service, calls, addRow } = setup();
    const { raw } = addRow();
    await service.refresh(raw);
    calls.length = 0;

    await expectInvalid(service.refresh(raw));

    expect(calls).toContain('revokeAllActiveForUser');
    expect(calls.indexOf('revokeAllActiveForUser')).toBeLessThan(calls.indexOf('commit'));
    expect(calls).not.toContain('rollback');
  });

  it('rejects a logged-out token without revoking the family', async () => {
    const { service, calls, addRow } = setup();
    const { raw } = addRow({ revokedAt: START, rotatedAt: null });

    await expectInvalid(service.refresh(raw));

    expect(calls).not.toContain('revokeAllActiveForUser');
    expect(calls).not.toContain('rotateRefreshToken');
  });

  it('rejects an expired token without revoking anything', async () => {
    const { service, calls, addRow, advanceMs } = setup();
    const { raw } = addRow();
    advanceMs(8 * DAY_MS);

    await expectInvalid(service.refresh(raw));

    expect(calls).not.toContain('revokeAllActiveForUser');
    expect(calls).not.toContain('rotateRefreshToken');
  });

  it('treats a lost compare-and-set as reuse when the re-read shows it rotated', async () => {
    const { service, calls, addRow, setRotateResult, setReread } = setup();
    const { raw, row } = addRow();
    setRotateResult(0);
    setReread({ ...row, revokedAt: START, rotatedAt: START });

    await expectInvalid(service.refresh(raw));

    expect(calls).toContain('revokeAllActiveForUser');
    expect(calls.indexOf('revokeAllActiveForUser')).toBeLessThan(calls.indexOf('commit'));
    expect(calls).not.toContain('rollback');
  });

  it('rejects a lost compare-and-set without revoking when the re-read finds nothing', async () => {
    const { service, calls, addRow, setRotateResult, setReread } = setup();
    const { raw } = addRow();
    setRotateResult(0);
    setReread(null);

    await expectInvalid(service.refresh(raw));

    expect(calls).not.toContain('revokeAllActiveForUser');
    expect(calls).not.toContain('createRefreshToken');
  });
});
