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

  // ---- Password reset (AB-1003). The user is known here, so every query is scoped by userId.

  invalidateUnusedOtps: async (userId: string, now: Date): Promise<number> =>
    (
      await db.passwordResetOtp.updateMany({
        where: { userId, usedAt: null, invalidatedAt: null },
        data: { invalidatedAt: now },
      })
    ).count,

  createOtp: ({
    userId,
    otpHash,
    expiresAt,
  }: Pick<Prisma.PasswordResetOtpUncheckedCreateInput, 'userId' | 'otpHash' | 'expiresAt'>) =>
    db.passwordResetOtp.create({ data: { userId, otpHash, expiresAt } }),

  // Newest first, with id as the tie-break, so two OTPs issued in the same millisecond still have
  // exactly one latest.
  findLatestOtp: (userId: string) =>
    db.passwordResetOtp.findFirst({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }),

  // One atomic UPDATE that counts the attempt only while the OTP is still usable and under the
  // limit, so parallel guesses cannot all slip in below it. 0 means the OTP cannot be tried.
  claimOtpAttempt: async (
    id: string,
    userId: string,
    now: Date,
    maxAttempts: number,
  ): Promise<number> =>
    (
      await db.passwordResetOtp.updateMany({
        where: {
          id,
          userId,
          usedAt: null,
          invalidatedAt: null,
          expiresAt: { gt: now },
          attempts: { lt: maxAttempts },
        },
        data: { attempts: { increment: 1 } },
      })
    ).count,

  findOtp: (id: string, userId: string) => db.passwordResetOtp.findFirst({ where: { id, userId } }),

  invalidateOtp: async (id: string, userId: string, now: Date): Promise<number> =>
    (
      await db.passwordResetOtp.updateMany({
        where: { id, userId, invalidatedAt: null },
        data: { invalidatedAt: now },
      })
    ).count,

  // Compare-and-set: of two concurrent resets with one OTP, only one sees usedAt still null.
  markOtpUsed: async (id: string, userId: string, now: Date): Promise<number> =>
    (
      await db.passwordResetOtp.updateMany({
        where: { id, userId, usedAt: null },
        data: { usedAt: now },
      })
    ).count,

  updatePasswordHash: (userId: string, passwordHash: string) =>
    db.user.update({ where: { id: userId }, data: { passwordHash } }),
});

export const createAuthRepository = (prisma: PrismaClient) => ({
  ...methodsFor(prisma),
  // The service owns the transaction boundary; the callback gets the same methods bound to it.
  transaction: <T>(fn: (repository: ReturnType<typeof methodsFor>) => Promise<T>): Promise<T> =>
    prisma.$transaction((tx) => fn(methodsFor(tx))),
});

export type AuthRepository = ReturnType<typeof createAuthRepository>;
