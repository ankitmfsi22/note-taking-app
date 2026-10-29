import {
  NoteIdParamsSchema,
  SetNoteTagsRequestSchema,
  TagCreateRequestSchema,
  TagIdParamsSchema,
  TagUpdateRequestSchema,
} from '@note-app/shared';
import { Router, type RequestHandler } from 'express';
import { validate } from '../../common/http/validate.js';
import type { TagsController } from './tags.controller.js';

export const createTagsRouter = ({
  controller,
  requireAuth,
}: {
  controller: TagsController;
  requireAuth: RequestHandler;
}): Router => {
  const router = Router();
  const params = { params: TagIdParamsSchema };

  // Authentication runs before validation, so an anonymous caller always gets 401.
  router.use(requireAuth);

  router.get('/', controller.list);
  router.post('/', validate({ body: TagCreateRequestSchema }), controller.create);
  router.patch('/:tagId', validate({ ...params, body: TagUpdateRequestSchema }), controller.update);
  router.delete('/:tagId', validate(params), controller.remove);

  return router;
};

// Mounted under /api/v1/notes, after the notes router, so the path is /:noteId/tags.
export const createNoteTagsRouter = ({
  controller,
  requireAuth,
}: {
  controller: TagsController;
  requireAuth: RequestHandler;
}): Router => {
  const router = Router();
  router.put(
    '/:noteId/tags',
    requireAuth,
    validate({ params: NoteIdParamsSchema, body: SetNoteTagsRequestSchema }),
    controller.setNoteTags,
  );
  return router;
};
