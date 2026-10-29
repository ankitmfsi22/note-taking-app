import type { TipTapDoc } from '@note-app/shared';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';

type Db = PrismaClient | Prisma.TransactionClient;

// Versions are reached through their note, so userId and "not trashed" are part of every WHERE
// (SDS 6.5). The insert and the retention delete only run inside the locked save transaction.
export const versionMethodsFor = (db: Db) => ({
  insertVersion: (
    noteId: string,
    data: { versionNumber: number; title: string; content: TipTapDoc },
    now: Date,
  ) => db.noteVersion.create({ data: { noteId, ...data, createdAt: now } }),

  // Keeps exactly the newest VERSION_KEEP versions: everything at or below `upTo` goes.
  deleteVersionsUpTo: async (noteId: string, upTo: number): Promise<number> =>
    (await db.noteVersion.deleteMany({ where: { noteId, versionNumber: { lte: upTo } } })).count,

  findVersionForUser: (noteId: string, userId: string, versionNumber: number) =>
    db.noteVersion.findFirst({
      where: { noteId, versionNumber, note: { userId, deletedAt: null } },
    }),

  listVersionsForUser: async (
    noteId: string,
    userId: string,
    { skip, take }: { skip: number; take: number },
  ) => {
    const where = { noteId, note: { userId, deletedAt: null } };
    const [items, total] = await Promise.all([
      db.noteVersion.findMany({
        where,
        orderBy: { versionNumber: 'desc' },
        skip,
        take,
        select: { versionNumber: true, title: true, createdAt: true },
      }),
      db.noteVersion.count({ where }),
    ]);
    return { items, total };
  },
});

export const createVersionsRepository = (prisma: PrismaClient) => versionMethodsFor(prisma);

export type VersionsRepository = ReturnType<typeof createVersionsRepository>;
