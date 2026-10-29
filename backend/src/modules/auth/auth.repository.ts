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
});

export const createAuthRepository = (prisma: PrismaClient) => ({
  ...methodsFor(prisma),
  // The service owns the transaction boundary; the callback gets the same methods bound to it.
  transaction: <T>(fn: (repository: ReturnType<typeof methodsFor>) => Promise<T>): Promise<T> =>
    prisma.$transaction((tx) => fn(methodsFor(tx))),
});

export type AuthRepository = ReturnType<typeof createAuthRepository>;
