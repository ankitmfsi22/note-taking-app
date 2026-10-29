import {
  REFRESH_TOKEN_TTL_DAYS,
  type LoginRequest,
  type PublicUser,
  type RegisterRequest,
} from '@note-app/shared';
import type { Clock } from '../../common/clock.js';
import { AppError } from '../../common/errors/app-error.js';
import type { PasswordHasher } from '../../common/security/hash.js';
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from '../../common/security/tokens.js';
import type { AuthRepository } from './auth.repository.js';

type UserRow = NonNullable<Awaited<ReturnType<AuthRepository['findUserByEmail']>>>;

const REFRESH_TTL_MS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

// The only place a user row becomes the API shape, so passwordHash cannot reach a response (S-03).
const toPublicUser = (user: UserRow): PublicUser => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  createdAt: user.createdAt.toISOString(),
});

const emailTaken = () => new AppError('EMAIL_TAKEN', 'An account with this email already exists');

// One factory for both login failures, so the message cannot differ (AC-AUTH-10).
const invalidCredentials = () => new AppError('INVALID_CREDENTIALS', 'Invalid email or password');

export const createAuthService = ({
  repository,
  clock,
  passwordHasher,
  accessTokenSecret,
}: {
  repository: AuthRepository;
  clock: Clock;
  passwordHasher: PasswordHasher;
  accessTokenSecret: string;
}) => {
  // Stores only the hash; the raw token is returned for the cookie and exists nowhere else.
  const issueRefreshToken = async (
    db: Pick<AuthRepository, 'createRefreshToken'>,
    userId: string,
  ): Promise<string> => {
    const refreshToken = generateRefreshToken();
    await db.createRefreshToken({
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(clock.now().getTime() + REFRESH_TTL_MS),
    });
    return refreshToken;
  };

  const issueAccessToken = (userId: string): Promise<string> =>
    signAccessToken({ userId, now: clock.now(), secret: accessTokenSecret });

  return {
    register: async ({ email, password, displayName }: RegisterRequest) => {
      if (await repository.findUserByEmail(email)) throw emailTaken();
      const passwordHash = await passwordHasher.hash(password);

      // A concurrent register for the same email passes the check above; the unique index decides.
      const { user, refreshToken } = await repository.transaction(async (tx) => {
        const created = await tx.createUser({
          email,
          passwordHash,
          displayName: displayName ?? null,
        });
        if (created === null) throw emailTaken();
        return { user: created, refreshToken: await issueRefreshToken(tx, created.id) };
      });

      return {
        user: toPublicUser(user),
        accessToken: await issueAccessToken(user.id),
        refreshToken,
      };
    },

    login: async ({ email, password }: LoginRequest) => {
      const user = await repository.findUserByEmail(email);
      if (user === null) {
        // Same Argon2 work as a real check, so response time does not reveal the missing account.
        await passwordHasher.verifyDummy(password);
        throw invalidCredentials();
      }
      if (!(await passwordHasher.verify(user.passwordHash, password))) throw invalidCredentials();

      return {
        user: toPublicUser(user),
        accessToken: await issueAccessToken(user.id),
        refreshToken: await issueRefreshToken(repository, user.id),
      };
    },

    refresh: async (rawToken: string | undefined) => {
      // The callback never throws: an error would roll back the family revocation, so the outcome
      // is returned and the error is raised only after the commit (SDS 5.2).
      const outcome = await repository.transaction(async (tx) => {
        const now = clock.now();
        if (rawToken === undefined) return { kind: 'invalid' } as const;
        const tokenHash = hashRefreshToken(rawToken);

        const row = await tx.findRefreshTokenByHash(tokenHash);
        if (row === null) return { kind: 'invalid' } as const;

        if (row.rotatedAt !== null) {
          await tx.revokeAllActiveForUser(row.userId, now);
          return { kind: 'reuse' } as const;
        }
        // Logged out or already revoked with its family: not a theft signal, so nothing else changes.
        if (row.revokedAt !== null || row.expiresAt <= now) return { kind: 'invalid' } as const;

        if ((await tx.rotateRefreshToken(row.id, now)) === 1) {
          return {
            kind: 'rotated',
            user: row.user,
            refreshToken: await issueRefreshToken(tx, row.userId),
          } as const;
        }

        // A concurrent refresh won the compare-and-set; if it rotated this token, this is a reuse.
        const current = await tx.findRefreshTokenByHash(tokenHash);
        if (current?.rotatedAt != null) {
          await tx.revokeAllActiveForUser(row.userId, now);
          return { kind: 'reuse' } as const;
        }
        return { kind: 'invalid' } as const;
      });

      if (outcome.kind !== 'rotated') {
        throw new AppError('INVALID_REFRESH_TOKEN', 'Invalid refresh token');
      }
      return {
        user: toPublicUser(outcome.user),
        accessToken: await issueAccessToken(outcome.user.id),
        refreshToken: outcome.refreshToken,
      };
    },

    // Idempotent: an unknown, revoked or missing token is not an error, and the count is ignored
    // (AC-AUTH-09). Only revokedAt is set, so the token is never mistaken for a rotated one.
    logout: async (rawToken: string | undefined): Promise<void> => {
      if (rawToken === undefined) return;
      await repository.revokeActiveToken(hashRefreshToken(rawToken), clock.now());
    },
  };
};

export type AuthService = ReturnType<typeof createAuthService>;
