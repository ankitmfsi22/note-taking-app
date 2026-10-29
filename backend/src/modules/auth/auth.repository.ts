import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';

type Db = PrismaClient | Prisma.TransactionClient;

// Auth looks accounts up by email or token hash, before any user is known, so these methods cannot
// take userId in their WHERE the way every other repository does.
const methodsFor = (db: Db) => ({
  findUserByEmail: (email: string) => db.user.findUnique({ where: { email } }),

  // null means the email is taken (unique violation), so the service never imports Prisma errors.
  createUser: async ({
    email,
    passwordHash,
    displayName,
  }: Required<Pick<Prisma.UserUncheckedCreateInput, 'email' | 'passwordHash' | 'displayName'>>) => {
    try {
      return await db.user.create({ data: { email, passwordHash, displayName } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return null;
      }
      throw error;
    }
  },

  createRefreshToken: ({
    userId,
    tokenHash,
    expiresAt,
  }: Pick<Prisma.RefreshTokenUncheckedCreateInput, 'userId' | 'tokenHash' | 'expiresAt'>) =>
    db.refreshToken.create({ data: { userId, tokenHash, expiresAt } }),

  findRefreshTokenByHash: (tokenHash: string) =>
    db.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } }),

  // Compare-and-set: only the request that still sees the row active changes it. Returns the count,
  // so 0 means a concurrent refresh won. Sets rotatedAt too, which is what marks it as replaced.
  rotateRefreshToken: async (id: string, now: Date): Promise<number> =>
    (
      await db.refreshToken.updateMany({
        where: { id, revokedAt: null },
        data: { revokedAt: now, rotatedAt: now },
      })
    ).count,

  // Logout and family revocation set revokedAt only, so a logged-out token is never taken for a
  // rotated one (AC-AUTH-12).
  revokeActiveToken: async (tokenHash: string, now: Date): Promise<number> =>
    (
      await db.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: now },
      })
    ).count,

  revokeAllActiveForUser: async (userId: string, now: Date): Promise<number> =>
    (
      await db.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      })
    ).count,
});

export const createAuthRepository = (prisma: PrismaClient) => ({
  ...methodsFor(prisma),
  // The service owns the transaction boundary; the callback gets the same methods bound to it.
  transaction: <T>(fn: (repository: ReturnType<typeof methodsFor>) => Promise<T>): Promise<T> =>
    prisma.$transaction((tx) => fn(methodsFor(tx))),
});

export type AuthRepository = ReturnType<typeof createAuthRepository>;
