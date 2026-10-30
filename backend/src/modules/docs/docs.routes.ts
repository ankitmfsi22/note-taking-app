import { Router } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import type { OpenApiDocument } from './openapi-document.js';

// Helmet's default CSP already allows what Swagger UI needs (inline styles, same-origin script
// files, data: images). The one directive that breaks it is upgrade-insecure-requests: over plain
// http (local dev, Safari) it turns the UI's asset requests into https and the page never loads.
const docsHelmet = helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'upgrade-insecure-requests': null,
    },
  },
});

// Mounted at /api/docs, outside /api/v1: public, no origin check, no requireAuth.
export const createDocsRouter = ({ document }: { document: OpenApiDocument }): Router => {
  const router = Router();

  router.use(docsHelmet);
  router.get('/openapi.json', (_req, res) => {
    res.json(document);
  });
  router.use(
    swaggerUi.serve,
    swaggerUi.setup(document, {
      customSiteTitle: 'Note Taking App API',
      swaggerOptions: { persistAuthorization: true },
    }),
  );

  return router;
};
