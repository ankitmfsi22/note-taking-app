import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export type OpenApiDocument = Record<string, unknown>;

// src/modules/docs (tsx) and dist/modules/docs (built) sit at the same depth under backend/,
// so one relative path reaches the repository's docs/ in both modes.
export const OPENAPI_SPEC_PATH = fileURLToPath(
  new URL('../../../../docs/api/openapi.yaml', import.meta.url),
);

export const loadOpenApiDocument = (path: string = OPENAPI_SPEC_PATH): OpenApiDocument => {
  const parsed: unknown = parse(readFileSync(path, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`OpenAPI document at ${path} is not a YAML mapping`);
  }
  return parsed as OpenApiDocument;
};
