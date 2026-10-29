import { randomBytes } from 'node:crypto';
import {
  SHARE_EXPIRY_MAX_DAYS,
  type CreateShareLinkRequest,
  type PaginationQuery,
} from '@note-app/shared';
import type { Clock } from '../../common/clock.js';
import { AppError } from '../../common/errors/app-error.js';
import type { SharesRepository } from './shares.repository.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const noteNotFound = () => new AppError('NOTE_NOT_FOUND', 'Note not found');
// One error and message for every unavailable link, so nothing reveals which case it is.
const linkNotFound = () => new AppError('SHARE_LINK_NOT_FOUND', 'Share link not found');

interface LinkRow {
  expiresAt: Date | null;
  revokedAt: Date | null;
}

// Revoked wins over expired. Uses the injected clock, never the database (SDS 8.3).
export const statusOf = ({ expiresAt, revokedAt }: LinkRow, now: Date) => {
  if (revokedAt) return 'revoked' as const;
  if (expiresAt && expiresAt.getTime() <= now.getTime()) return 'expired' as const;
  return 'active' as const;
};

export const createSharesService = ({
  repository,
  clock,
}: {
  repository: SharesRepository;
  clock: Clock;
}) => {
  const withStatus = <T extends LinkRow>(row: T) => ({
    ...row,
    status: statusOf(row, clock.now()),
  });

  return {
    create: async (userId: string, noteId: string, { expiresAt }: CreateShareLinkRequest) => {
      const now = clock.now();
      const expiry = expiresAt === undefined ? null : new Date(expiresAt);
      if (
        expiry !== null &&
        (expiry.getTime() <= now.getTime() ||
          expiry.getTime() > now.getTime() + SHARE_EXPIRY_MAX_DAYS * DAY_MS)
      ) {
        throw new AppError('VALIDATION_ERROR', 'Request validation failed', [
          {
            field: 'expiresAt',
            message: `Must be in the future and at most ${SHARE_EXPIRY_MAX_DAYS} days ahead`,
          },
        ]);
      }
      if (!(await repository.noteIsActiveForUser(noteId, userId))) throw noteNotFound();
      const token = randomBytes(32).toString('base64url');
      return withStatus(await repository.create(noteId, token, expiry, now));
    },

    listForNote: async (userId: string, noteId: string) => {
      if (!(await repository.noteIsActiveForUser(noteId, userId))) throw noteNotFound();
      return (await repository.listForNote(noteId, userId)).map(withStatus);
    },

    listActive: async (userId: string, { page, pageSize }: PaginationQuery) => {
      const { items, total } = await repository.listActiveForUser(userId, clock.now(), {
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
      return {
        items: items.map(withStatus),
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      };
    },

    revoke: async (userId: string, shareId: string) => {
      const link = await repository.revokeForUser(shareId, userId, clock.now());
      if (!link) throw linkNotFound();
      return withStatus(link);
    },

    viewPublic: async (token: string) => {
      const note = await repository.viewPublic(token);
      if (!note) throw linkNotFound();
      return note;
    },
  };
};

export type SharesService = ReturnType<typeof createSharesService>;
