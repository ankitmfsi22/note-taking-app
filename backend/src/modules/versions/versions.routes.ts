import { NoteIdParamsSchema, PaginationQuerySchema, VersionParamsSchema } from '@note-app/shared';
import { Router, type RequestHandler } from 'express';
import { validate } from '../../common/http/validate.js';
import type { VersionsController } from './versions.controller.js';

// Mounted at /api/v1/notes next to the notes router; the paths here never overlap with it.
export const createVersionsRouter = ({
  controller,
  requireAuth,
}: {
  controller: VersionsController;
  requireAuth: RequestHandler;
}): Router => {
  const router = Router();
  const version = { params: VersionParamsSchema };

  // Authentication runs before validation, so an anonymous caller always gets 401.
  router.get(
    '/:noteId/versions',
    requireAuth,
    validate({ params: NoteIdParamsSchema, query: PaginationQuerySchema }),
    controller.list,
  );
  router.get('/:noteId/versions/:versionNumber', requireAuth, validate(version), controller.get);
  router.post(
    '/:noteId/versions/:versionNumber/restore',
    requireAuth,
    validate(version),
    controller.restore,
  );

  return router;
};
