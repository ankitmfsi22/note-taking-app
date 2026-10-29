import {
  NoteResponseSchema,
  VersionDetailSchema,
  VersionListResponseSchema,
  type NoteIdParams,
  type PaginationQuery,
  type VersionParams,
} from '@note-app/shared';
import type { RequestHandler, Response } from 'express';
import { validParams, validQuery } from '../../common/http/validate.js';
import type { VersionsService } from './versions.service.js';

type Note = Awaited<ReturnType<VersionsService['restore']>>;

// requireAuth runs first on every versions route and always sets it.
const userIdOf = (res: Response): string => String(res.locals.userId);

// Same mapping as the notes controller; parsing drops userId, contentText and deletedAt.
const toNoteResponse = (note: Note) =>
  NoteResponseSchema.parse({
    id: note.id,
    title: note.title,
    content: note.content,
    tags: [],
    latestVersion: note.lastVersionNumber,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  });

export const createVersionsController = ({ service }: { service: VersionsService }) => ({
  list: (async (_req, res) => {
    const { noteId } = validParams<NoteIdParams>(res);
    const page = await service.list(userIdOf(res), noteId, validQuery<PaginationQuery>(res));
    res.json(
      VersionListResponseSchema.parse({
        ...page,
        items: page.items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
      }),
    );
  }) satisfies RequestHandler,

  get: (async (_req, res) => {
    const { noteId, versionNumber } = validParams<VersionParams>(res);
    const version = await service.get(userIdOf(res), noteId, versionNumber);
    res.json(VersionDetailSchema.parse({ ...version, createdAt: version.createdAt.toISOString() }));
  }) satisfies RequestHandler,

  restore: (async (_req, res) => {
    const { noteId, versionNumber } = validParams<VersionParams>(res);
    res.json(toNoteResponse(await service.restore(userIdOf(res), noteId, versionNumber)));
  }) satisfies RequestHandler,
});

export type VersionsController = ReturnType<typeof createVersionsController>;
