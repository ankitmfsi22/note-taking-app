import type { TipTapDoc } from '@note-app/shared';
import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';

type Db = PrismaClient | Prisma.TransactionClient;

interface NoteWrite {
  title: string;
  content: TipTapDoc;
  contentText: string;
}

// undefined leaves the column unchanged.
type NoteUpdate = { [K in keyof NoteWrite]?: NoteWrite[K] | undefined };

const toData = ({ title, content, contentText }: NoteUpdate) => ({
  ...(title === undefined ? {} : { title }),
  ...(content === undefined ? {} : { content }),
  ...(contentText === undefined ? {} : { contentText }),
});

// Every method is scoped by userId and named for the rows it can see (SDS 6.5): "active" means
// deletedAt IS NULL, "trashed" means deletedAt > cutoff (now - 30 days).
const methodsFor = (db: Db) => ({
  createForUser: (userId: string, data: NoteWrite, now: Date) =>
    db.note.create({
      data: {
        title: data.title,
        content: data.content,
        contentText: data.contentText,
        userId,
        createdAt: now,
        updatedAt: now,
      },
    }),

  findActiveByIdForUser: (id: string, userId: string) =>
    db.note.findFirst({ where: { id, userId, deletedAt: null } }),

  // null when the note is missing, not owned or trashed (P2025), so the service never sees Prisma.
  updateActiveForUser: async (id: string, userId: string, data: NoteUpdate, now: Date) => {
    try {
      return await db.note.update({
        where: { id, userId, deletedAt: null },
        data: { ...toData(data), updatedAt: now },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null;
      }
      throw error;
    }
  },

  // updatedAt is written back unchanged, because @updatedAt would otherwise bump it (SA-24).
  markDeleted: async (id: string, userId: string, now: Date, updatedAt: Date): Promise<number> =>
    (
      await db.note.updateMany({
        where: { id, userId, deletedAt: null },
        data: { deletedAt: now, updatedAt },
      })
    ).count,

  findTrashedByIdForUser: (id: string, userId: string, cutoff: Date) =>
    db.note.findFirst({ where: { id, userId, deletedAt: { gt: cutoff } } }),

  markRestored: async (id: string, userId: string, cutoff: Date, updatedAt: Date) =>
    (
      await db.note.updateManyAndReturn({
        where: { id, userId, deletedAt: { gt: cutoff } },
        data: { deletedAt: null, updatedAt },
      })
    )[0] ?? null,

  listTrashedForUser: async (
    userId: string,
    cutoff: Date,
    { skip, take }: { skip: number; take: number },
  ) => {
    const where = { userId, deletedAt: { gt: cutoff } };
    const [items, total] = await Promise.all([
      db.note.findMany({
        where,
        orderBy: [{ deletedAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
        select: { id: true, title: true, contentText: true, deletedAt: true },
      }),
      db.note.count({ where }),
    ]);
    return { items, total };
  },
});

export const createNotesRepository = (prisma: PrismaClient) => ({
  ...methodsFor(prisma),
  transaction: <T>(fn: (repository: ReturnType<typeof methodsFor>) => Promise<T>): Promise<T> =>
    prisma.$transaction((tx) => fn(methodsFor(tx))),
});

export type NotesRepository = ReturnType<typeof createNotesRepository>;

// The purge is system-wide housekeeping, not a user request, so it is the one place that is not
// scoped by userId. deleteMany re-checks the cutoff so a note restored meanwhile is never removed.
export const createTrashPurgeRepository = (prisma: PrismaClient) => ({
  findExpiredIds: async (cutoff: Date, limit: number): Promise<string[]> =>
    (
      await prisma.note.findMany({
        where: { deletedAt: { lte: cutoff } },
        orderBy: { deletedAt: 'asc' },
        take: limit,
        select: { id: true },
      })
    ).map((note) => note.id),

  deleteExpired: async (ids: string[], cutoff: Date): Promise<number> =>
    (await prisma.note.deleteMany({ where: { id: { in: ids }, deletedAt: { lte: cutoff } } }))
      .count,
});

export type TrashPurgeRepository = ReturnType<typeof createTrashPurgeRepository>;
