import { SearchResponseSchema, type SearchQuery } from '@note-app/shared';
import type { RequestHandler, Response } from 'express';
import { validQuery } from '../../common/http/validate.js';
import type { SearchService } from './search.service.js';

// requireAuth runs first on the search route and always sets it.
const userIdOf = (res: Response): string => String(res.locals.userId);

export const createSearchController = ({ service }: { service: SearchService }) => ({
  search: (async (_req, res) => {
    const page = await service.search(userIdOf(res), validQuery<SearchQuery>(res));
    res.json(
      SearchResponseSchema.parse({
        ...page,
        items: page.items.map((item) => ({ ...item, updatedAt: item.updatedAt.toISOString() })),
      }),
    );
  }) satisfies RequestHandler,
});

export type SearchController = ReturnType<typeof createSearchController>;
