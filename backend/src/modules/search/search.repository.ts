import type { PrismaClient } from '../../generated/prisma/client.js';

export interface SearchTag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface SearchRow {
  id: string;
  title: string;
  updatedAt: Date;
  total: bigint;
  titleHl: string;
  snippetHl: string;
}

export interface SearchPageParams {
  q: string;
  offset: number;
  limit: number;
  titleOptions: string;
  snippetOptions: string;
  // Stand-ins for "<" and ">" in the content text while ts_headline runs (see escape-highlight.ts).
  angleOpen: string;
  angleClose: string;
}

// Prisma sends every ${} below as a bound parameter, so q is never part of the SQL text.
export const createSearchRepository = (prisma: PrismaClient) => ({
  // userId and "deletedAt" IS NULL are in the WHERE, so other users' and trashed notes never match.
  // ts_headline runs only on the page's rows, after LIMIT (SDS 8.2).
  searchActiveForUser: (userId: string, params: SearchPageParams) =>
    prisma.$queryRaw<SearchRow[]>`
      WITH q AS (SELECT plainto_tsquery('english', ${params.q}) AS query),
      matches AS (
        SELECT n.id, n.title, n."contentText", n."updatedAt",
               ts_rank(n."searchVector", q.query) AS rank,
               count(*) OVER () AS total
        FROM "Note" n, q
        WHERE n."userId" = ${userId}::uuid
          AND n."deletedAt" IS NULL
          AND n."searchVector" @@ q.query
        ORDER BY rank DESC, n."updatedAt" DESC, n.id
        LIMIT ${params.limit}::int OFFSET ${params.offset}::int
      )
      SELECT m.id, m.title, m."updatedAt", m.total,
             ts_headline('english', m.title, q.query, ${params.titleOptions}) AS "titleHl",
             ts_headline(
               'english',
               replace(replace(m."contentText", '<', ${params.angleOpen}), '>', ${params.angleClose}),
               q.query, ${params.snippetOptions}) AS "snippetHl"
      FROM matches m, q
      ORDER BY m.rank DESC, m."updatedAt" DESC, m.id`,

  // Only needed for a page past the end, where no row carries the window total.
  countActiveForUser: async (userId: string, q: string): Promise<number> => {
    const rows = await prisma.$queryRaw<{ total: bigint }[]>`
      SELECT count(*) AS total
      FROM "Note" n
      WHERE n."userId" = ${userId}::uuid
        AND n."deletedAt" IS NULL
        AND n."searchVector" @@ plainto_tsquery('english', ${q})`;
    return Number(rows[0]?.total ?? 0);
  },

  // The tags of the page's notes, ordered by name like the notes list. userId is in the WHERE, so
  // only the caller's notes are read.
  findTagsForNotes: async (
    userId: string,
    noteIds: string[],
  ): Promise<Map<string, SearchTag[]>> => {
    const links = await prisma.noteTag.findMany({
      where: { noteId: { in: noteIds }, note: { userId } },
      select: {
        noteId: true,
        tag: { select: { id: true, name: true, color: true, createdAt: true } },
      },
      orderBy: [{ tag: { name: 'asc' } }, { tagId: 'asc' }],
    });
    const byNote = new Map<string, SearchTag[]>(noteIds.map((id) => [id, []]));
    for (const { noteId, tag } of links) {
      byNote.get(noteId)?.push({ ...tag, createdAt: tag.createdAt.toISOString() });
    }
    return byNote;
  },
});

export type SearchRepository = ReturnType<typeof createSearchRepository>;
