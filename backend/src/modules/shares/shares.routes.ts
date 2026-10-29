import {
  CreateShareLinkRequestSchema,
  NoteIdParamsSchema,
  PaginationQuerySchema,
  ShareIdParamsSchema,
  ShareTokenParamsSchema,
} from '@note-app/shared';
import { Router, type RequestHandler } from 'express';
import { validate } from '../../common/http/validate.js';
import type { SharesController } from './shares.controller.js';

// Mounted at /api/v1. requireAuth is per route, not router-wide, because the public route is
// anonymous and ignores any Authorization header (ERR-SHARE-09). Authentication runs before
// validation, so an anonymous caller always gets 401.
export const createSharesRouter = ({
  controller,
  requireAuth,
}: {
  controller: SharesController;
  requireAuth: RequestHandler;
}): Router => {
  const router = Router();
  const noteParams = { params: NoteIdParamsSchema };

  router.post(
    '/notes/:noteId/shares',
    requireAuth,
    validate({ ...noteParams, body: CreateShareLinkRequestSchema }),
    controller.create,
  );
  router.get('/notes/:noteId/shares', requireAuth, validate(noteParams), controller.listForNote);
  router.get(
    '/shares',
    requireAuth,
    validate({ query: PaginationQuerySchema }),
    controller.listActive,
  );
  router.post(
    '/shares/:shareId/revoke',
    requireAuth,
    validate({ params: ShareIdParamsSchema }),
    controller.revoke,
  );
  router.get(
    '/public/shares/:token',
    validate({ params: ShareTokenParamsSchema }),
    controller.viewPublic,
  );

  return router;
};
