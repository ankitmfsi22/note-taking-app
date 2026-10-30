import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

// Returns the text of one top-level service block of docker-compose.yml.
const service = (compose, name) => {
  const match = new RegExp(`^ {2}${name}:\\n((?: {4}.*\\n|\\n)+)`, 'm').exec(compose);
  assert.ok(match, `service ${name} not found`);
  return match[1];
};

test('S-AB1016-26: the backend image is pinned, non-root, migrating and health-checked', () => {
  const dockerfile = read('backend/Dockerfile');
  const bases = [...dockerfile.matchAll(/^FROM\s+(\S+)/gm)].map((match) => match[1]);
  assert.ok(bases.length >= 2, 'multi-stage build');
  for (const base of bases) assert.match(base, /^node:22\.\d+\.\d+-slim$/);
  assert.match(dockerfile, /^USER node$/m);
  assert.match(dockerfile, /prisma migrate deploy\) && exec node dist\/server\.js/);
  assert.match(dockerfile, /HEALTHCHECK[\s\S]*\/api\/v1\/health/);
  assert.doesNotMatch(dockerfile, /curl/);
  // The API docs module reads docs/api/openapi.yaml at runtime.
  assert.match(dockerfile, /cp \/repo\/docs\/api\/openapi\.yaml \/out\/docs\/api\/openapi\.yaml/);
});

test('S-AB1016-27: nginx serves the SPA with caching rules and proxies the API', () => {
  const dockerfile = read('frontend/Dockerfile');
  assert.match(dockerfile, /^FROM nginxinc\/nginx-unprivileged:\d+\.\d+\.\d+-alpine AS runtime$/m);
  const conf = read('frontend/nginx.conf');
  assert.match(conf, /try_files \$uri \$uri\/ \/index\.html;/);
  assert.match(conf, /gzip on;/);
  assert.match(
    conf,
    /location \/assets\/ \{[^}]*Cache-Control "public, max-age=31536000, immutable"/,
  );
  assert.match(conf, /location = \/index\.html \{[^}]*Cache-Control "no-cache"/);
  assert.match(conf, /location \/api\/ \{[\s\S]*set \$backend http:\/\/backend:3000;/);
  assert.match(conf, /proxy_set_header Host \$http_host;/);
  assert.match(conf, /proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;/);
});

test('S-AB1016-28: the full profile is health-gated, persistent and exposes only the frontend', () => {
  const compose = read('docker-compose.yml');
  const db = service(compose, 'db');
  const backend = service(compose, 'backend');
  const frontend = service(compose, 'frontend');
  for (const block of [db, backend, frontend]) {
    assert.match(block, /profiles: \['full'\]/);
    assert.match(block, /restart: unless-stopped/);
  }
  assert.match(db, /healthcheck:/);
  assert.match(db, /noteapp_full_data:\/var\/lib\/postgresql\/data/);
  assert.match(backend, /db:\n\s+condition: service_healthy/);
  assert.match(frontend, /backend:\n\s+condition: service_healthy/);
  assert.match(frontend, /ports: \['8080:8080'\]/);
  assert.doesNotMatch(db, /ports:/);
  assert.doesNotMatch(backend, /ports:/);
  assert.doesNotMatch(compose, /:latest/);
});

test('S-AB1016-29: the dev databases keep their ports and are started by the db scripts', () => {
  const compose = read('docker-compose.yml');
  const dev = service(compose, 'db-dev');
  const testDb = service(compose, 'db-test');
  assert.match(dev, /profiles: \['dev'\]/);
  assert.match(dev, /ports: \['5432:5432'\]/);
  assert.match(testDb, /profiles: \['dev'\]/);
  assert.match(testDb, /ports: \['5433:5432'\]/);
  const scripts = JSON.parse(read('package.json')).scripts;
  assert.match(scripts['db:up'], /--profile dev/);
  assert.match(scripts['db:down'], /--profile dev/);
});

test('S-AB1016-30: env files and build output stay out of the build context', () => {
  const ignore = read('.dockerignore').split('\n');
  for (const entry of ['.env*', '**/node_modules', '**/dist', '.git']) {
    assert.ok(ignore.includes(entry), `.dockerignore lists ${entry}`);
  }
  for (const file of ['backend/Dockerfile', 'frontend/Dockerfile']) {
    assert.doesNotMatch(read(file), /^(COPY|ADD)\b.*\.env/m);
  }
  const backend = service(read('docker-compose.yml'), 'backend');
  assert.match(backend, /JWT_ACCESS_SECRET: \$\{JWT_ACCESS_SECRET:\?[^}]+\}/);
  assert.match(backend, /OTP_HMAC_SECRET: \$\{OTP_HMAC_SECRET:\?[^}]+\}/);
});

test('S-AB1016-31: the backend origin matches the published frontend origin', () => {
  const compose = read('docker-compose.yml');
  const backend = service(compose, 'backend');
  assert.match(backend, /APP_ORIGIN: \$\{DOCKER_APP_ORIGIN:-http:\/\/localhost:8080\}/);
  assert.match(backend, /NODE_ENV: production/);
  assert.match(backend, /COOKIE_SECURE: 'true'/);
  assert.match(backend, /API_DOCS_ENABLED: 'true'/);
  assert.match(service(compose, 'frontend'), /ports: \['8080:8080'\]/);
});
