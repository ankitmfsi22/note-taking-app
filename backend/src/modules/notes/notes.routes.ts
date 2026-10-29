import {
  NoteCreateRequestSchema,
  NoteIdParamsSchema,
  NoteListQuerySchema,
  NoteUpdateRequestSchema,
  PaginationQuerySchema,
} from '@note-app/shared';
import { Router, type RequestHandler } from 'express';
import { validate } from '../../common/http/validate.js';
import type { NotesController } from './notes.controller.js';

export const createNotesRouter = ({
  controller,
  requireAuth,
}: {
  controller: NotesController;
  requireAuth: RequestHandler;
}): Router => {
  const router = Router();
  const params = { params: NoteIdParamsSchema };

  // Authentication runs before validation, so an anonymous caller always gets 401.
  router.use(requireAuth);

  router.get('/', validate({ query: NoteListQuerySchema }), controller.list);
  router.post('/', validate({ body: NoteCreateRequestSchema }), controller.create);
  // Before /:noteId, or "trash" would be validated as a note id and fail with 400 (SDS 7.1).
  router.get('/trash', validate({ query: PaginationQuerySchema }), controller.listTrash);
  router.get('/:noteId', validate(params), controller.get);
  router.patch(
    '/:noteId',
    validate({ ...params, body: NoteUpdateRequestSchema }),
    controller.update,
  );
  router.delete('/:noteId', validate(params), controller.remove);
  router.post('/:noteId/restore', validate(params), controller.restore);

  return router;
};
