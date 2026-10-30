import { Prisma, type PrismaClient } from '../../generated/prisma/client.js';
import { withTags } from '../notes/notes.repository.js';

type Db = PrismaClient | Prisma.TransactionClient;

interface TagWrite {
  name: string;
  nameKey: string;
  color: string;
}

// undefined leaves the column unchanged.
type TagUpdate = { [K in keyof TagWrite]?: TagWrite[K] | undefined };

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

// Every method is scoped by userId. null means missing or not owned (or a taken name where noted).
const methodsFor = (db: Db) => ({
  // null when the user already has this nameKey (P2002).
  createForUser: async (userId: string, data: TagWrite) => {
    try {
      return await db.tag.create({ data: { ...data, userId } });
    } catch (error) {
      if (isUniqueViolation(error)) return null;
      throw error;
    }
  },

  // noteCount counts only the caller's non-deleted notes (A-21).
  listWithCountForUser: async (userId: string) => {
    const tags = await db.tag.findMany({
      where: { userId },
      orderBy: [{ nameKey: 'asc' }, { id: 'asc' }],
      include: { _count: { select: { noteTags: { where: { note: { deletedAt: null } } } } } },
    });
    return tags.map(({ _count, ...tag }) => ({ ...tag, noteCount: _count.noteTags }));
  },

  findByIdForUser: (id: string, userId: string) => db.tag.findFirst({ where: { id, userId } }),

  // 'missing' for P2025 (not found or not owned), 'taken' for P2002.
  updateForUser: async (id: string, userId: string, data: TagUpdate) => {
    try {
      return await db.tag.update({
        where: { id, userId },
        data: {
          ...(data.name === undefined ? {} : { name: data.name }),
          ...(data.nameKey === undefined ? {} : { nameKey: data.nameKey }),
          ...(data.color === undefined ? {} : { color: data.color }),
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) return 'taken' as const;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return 'missing' as const;
      }
      throw error;
    }
  },

  deleteForUser: async (id: string, userId: string): Promise<number> =>
    (await db.tag.deleteMany({ where: { id, userId } })).count,

  countForUser: (userId: string, ids: string[]) =>
    db.tag.count({ where: { userId, id: { in: ids } } }),

  findActiveNoteForUser: (noteId: string, userId: string) =>
    db.note.findFirst({ where: { id: noteId, userId, deletedAt: null }, select: { id: true } }),

  // Never touches Note, so updatedAt stays as it was (SA-24).
  replaceNoteTags: async (noteId: string, userId: string, tagIds: string[]) => {
    await db.noteTag.deleteMany({ where: { noteId, note: { userId } } });
    if (tagIds.length > 0) {
      await db.noteTag.createMany({ data: tagIds.map((tagId) => ({ noteId, tagId })) });
    }
  },

  findNoteWithTagsForUser: (noteId: string, userId: string) =>
    db.note.findFirst({ where: { id: noteId, userId, deletedAt: null }, include: withTags }),
});

export const createTagsRepository = (prisma: PrismaClient) => ({
  ...methodsFor(prisma),
  transaction: <T>(fn: (repository: ReturnType<typeof methodsFor>) => Promise<T>): Promise<T> =>
    prisma.$transaction((tx) => fn(methodsFor(tx))),
});

export type TagsRepository = ReturnType<typeof createTagsRepository>;
