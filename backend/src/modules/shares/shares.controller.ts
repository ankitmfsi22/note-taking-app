import {
  ActiveShareLinkListResponseSchema,
  PublicSharedNoteSchema,
  ShareLinkListResponseSchema,
  ShareLinkResponseSchema,
  type CreateShareLinkRequest,
  type NoteIdParams,
  type PaginationQuery,
  type ShareIdParams,
  type ShareTokenParams,
} from '@note-app/shared';
import type { RequestHandler, Response } from 'express';
import { validBody, validParams, validQuery } from '../../common/http/validate.js';
import type { SharesService } from './shares.service.js';

type Link = Awaited<ReturnType<SharesService['revoke']>>;

// requireAuth runs first on every owner route and always sets it.
const userIdOf = (res: Response): string => String(res.locals.userId);

const linkJson = <T extends Link>(link: T) => ({
  ...link,
  expiresAt: link.expiresAt?.toISOString() ?? null,
  revokedAt: link.revokedAt?.toISOString() ?? null,
  createdAt: link.createdAt.toISOString(),
});

// Parsing with the shared schema drops any column that is not part of the response.
const toLinkResponse = (link: Link) => ShareLinkResponseSchema.parse(linkJson(link));

export const createSharesController = ({ service }: { service: SharesService }) => ({
  create: (async (_req, res) => {
    const { noteId } = validParams<NoteIdParams>(res);
    const link = await service.create(
      userIdOf(res),
      noteId,
      validBody<CreateShareLinkRequest>(res),
    );
    res.status(201).json(toLinkResponse(link));
  }) satisfies RequestHandler,

  listForNote: (async (_req, res) => {
    const { noteId } = validParams<NoteIdParams>(res);
    const items = await service.listForNote(userIdOf(res), noteId);
    res.json(ShareLinkListResponseSchema.parse({ items: items.map(linkJson) }));
  }) satisfies RequestHandler,

  listActive: (async (_req, res) => {
    const page = await service.listActive(userIdOf(res), validQuery<PaginationQuery>(res));
    res.json(ActiveShareLinkListResponseSchema.parse({ ...page, items: page.items.map(linkJson) }));
  }) satisfies RequestHandler,

  revoke: (async (_req, res) => {
    const { shareId } = validParams<ShareIdParams>(res);
    res.json(toLinkResponse(await service.revoke(userIdOf(res), shareId)));
  }) satisfies RequestHandler,

  viewPublic: (async (_req, res) => {
    const { token } = validParams<ShareTokenParams>(res);
    const note = await service.viewPublic(token);
    res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
    res.json(PublicSharedNoteSchema.parse({ ...note, updatedAt: note.updatedAt.toISOString() }));
  }) satisfies RequestHandler,
});

export type SharesController = ReturnType<typeof createSharesController>;
