import type { PrismaClient } from '../../generated/prisma/client.js';

export interface PublicNoteRow {
  title: string;
  content: unknown;
  updatedAt: Date;
}

// Ownership is always checked through the note: a link has no userId of its own (SDS 6.2).
export const createSharesRepository = (prisma: PrismaClient) => ({
  noteIsActiveForUser: async (noteId: string, userId: string): Promise<boolean> =>
    (await prisma.note.count({ where: { id: noteId, userId, deletedAt: null } })) > 0,

  create: (noteId: string, token: string, expiresAt: Date | null, now: Date) =>
    prisma.shareLink.create({ data: { noteId, token, expiresAt, createdAt: now } }),

  listForNote: (noteId: string, userId: string) =>
    prisma.shareLink.findMany({
      where: { noteId, note: { userId, deletedAt: null } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }),

  // Active means not revoked, not expired and the note not soft-deleted (AC-SHARE-11).
  listActiveForUser: async (
    userId: string,
    now: Date,
    { skip, take }: { skip: number; take: number },
  ) => {
    const where = {
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      note: { userId, deletedAt: null },
    };
    const [rows, total] = await Promise.all([
      prisma.shareLink.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
        include: { note: { select: { title: true } } },
      }),
      prisma.shareLink.count({ where }),
    ]);
    return { items: rows.map(({ note, ...link }) => ({ ...link, noteTitle: note.title })), total };
  },

  // Sets revokedAt only when it is null, then re-reads, so a repeat revoke changes nothing.
  // null when the link is missing or its note is not the caller's.
  revokeForUser: async (id: string, userId: string, now: Date) => {
    await prisma.shareLink.updateMany({
      where: { id, revokedAt: null, note: { userId } },
      data: { revokedAt: now },
    });
    return prisma.shareLink.findFirst({ where: { id, note: { userId } } });
  },

  // One statement checks availability, counts the view and returns the note (SDS 8.3). The row
  // lock of UPDATE serialises concurrent viewers. Expiry uses the database clock (SA-18).
  viewPublic: async (token: string): Promise<PublicNoteRow | null> => {
    const rows = await prisma.$queryRaw<PublicNoteRow[]>`
      UPDATE "ShareLink" sl
      SET "viewCount" = sl."viewCount" + 1
      FROM "Note" n
      WHERE sl."token" = ${token}
        AND sl."revokedAt" IS NULL
        AND (sl."expiresAt" IS NULL OR sl."expiresAt" > now())
        AND n."id" = sl."noteId"
        AND n."deletedAt" IS NULL
      RETURNING n."title", n."content", n."updatedAt"`;
    return rows[0] ?? null;
  },
});

export type SharesRepository = ReturnType<typeof createSharesRepository>;
