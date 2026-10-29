import { SearchQuerySchema } from '@note-app/shared';
import { Router, type RequestHandler } from 'express';
import { validate } from '../../common/http/validate.js';
import type { SearchController } from './search.controller.js';

export const createSearchRouter = ({
  controller,
  requireAuth,
}: {
  controller: SearchController;
  requireAuth: RequestHandler;
}): Router => {
  const router = Router();

  // Authentication runs before validation, so an anonymous caller always gets 401.
  router.get('/', requireAuth, validate({ query: SearchQuerySchema }), controller.search);

  return router;
};
