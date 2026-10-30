import SwaggerParser from '@apidevtools/swagger-parser';
import { describe, expect, it } from 'vitest';
import {
  loadOpenApiDocument,
  OPENAPI_SPEC_PATH,
} from '../../../src/modules/docs/openapi-document.js';
import { createTestApp, createTestEnv } from '../../support/test-app.js';

// Express 5 router internals that the route walk needs. Only the fields read below are typed.
interface RouterLayer {
  matchers: ((path: string) => false | { path: string })[];
  route?: { path: string; methods: Record<string, boolean> };
  handle: { stack?: RouterLayer[] };
}

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch'] as const;
const PROBE = 'probe';

// A registered route is identified by its position in the stack, so two routes that share a
// path (GET and POST /notes) stay distinct.
const collectRoutes = (stack: RouterLayer[], trail: string): string[] =>
  stack.flatMap((layer, index) => {
    const here = `${trail}/${String(index)}`;
    if (layer.route) {
      return Object.keys(layer.route.methods).map((method) => `${here}:${method}`);
    }
    return layer.handle.stack ? collectRoutes(layer.handle.stack, here) : [];
  });

// Walks the stack the way Express does and returns the id of the first route that answers.
const resolveRoute = (
  stack: RouterLayer[],
  method: string,
  url: string,
  trail: string,
): string | undefined => {
  for (const [index, layer] of stack.entries()) {
    const here = `${trail}/${String(index)}`;
    const matched = layer.matchers[0]?.(url);
    if (!matched) continue;
    if (layer.route) {
      if (layer.route.methods[method] === true) return `${here}:${method}`;
    } else if (layer.handle.stack) {
      const rest = url.slice(matched.path.length);
      const found = resolveRoute(layer.handle.stack, method, rest === '' ? '/' : rest, here);
      if (found) return found;
    }
  }
  return undefined;
};

const operationsOf = (document: Record<string, unknown>) => {
  const paths = document['paths'] as Record<string, Record<string, unknown>>;
  return Object.entries(paths).flatMap(([path, item]) =>
    HTTP_METHODS.filter((method) => method in item).map((method) => ({
      method,
      path,
      // /notes/{noteId}/tags -> /api/v1/notes/probe/tags
      url: `/api/v1${path.replace(/\{[^}]+\}/g, PROBE)}`,
    })),
  );
};

describe('docs/api/openapi.yaml', () => {
  it('S-AB1016-06: is a valid OpenAPI 3.1 document with both security schemes', async () => {
    const document = loadOpenApiDocument();
    await SwaggerParser.validate(OPENAPI_SPEC_PATH);

    expect(document['openapi']).toBe('3.1.0');
    expect(document['servers']).toEqual([expect.objectContaining({ url: '/api/v1' })]);
    const schemes = (document['components'] as { securitySchemes: Record<string, unknown> })
      .securitySchemes;
    expect(schemes['bearerAuth']).toMatchObject({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
    expect(schemes['refreshCookie']).toMatchObject({
      type: 'apiKey',
      in: 'cookie',
      name: 'refresh_token',
    });
  });

  it('S-AB1016-07: documents every registered route and nothing else', () => {
    // Docs off, so only the API routes are on the stack; the Prisma double is never touched.
    const { app } = createTestApp({ env: createTestEnv({ API_DOCS_ENABLED: 'false' }) });
    const stack = (app as unknown as { router: { stack: RouterLayer[] } }).router.stack;

    const registered = collectRoutes(stack, '');
    const documented = operationsOf(loadOpenApiDocument()).map(({ method, url }) => ({
      method,
      url,
      route: resolveRoute(stack, method, url, ''),
    }));

    const undocumentedOperations = documented.filter(({ route }) => route === undefined);
    expect(undocumentedOperations, 'spec operations with no Express route').toEqual([]);

    const hit = new Set(documented.map(({ route }) => route));
    expect(
      registered.filter((route) => !hit.has(route)),
      'Express routes missing from the spec',
    ).toEqual([]);

    expect(registered).toHaveLength(28);
    expect(documented).toHaveLength(28);
  });
});
