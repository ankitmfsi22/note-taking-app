// Reproducible Lighthouse run against the PRODUCTION build (AB-1016).
//
//   pnpm build && pnpm perf:lighthouse [--label after] [--runs 3] [--pages login,notes]
//
// It starts the built backend (backend/dist) and `vite preview` on private ports, seeds a demo user
// through the public API, drives a headless Chromium (login for the authenticated pages) and runs
// Lighthouse for mobile and desktop. Reports go to lighthouse-reports/<label>/ (gitignored).
// Needs `pnpm db:up` (the dev Postgres container). It uses its own database, noteapp_lighthouse.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { chromium } from 'playwright-core';

const root = path.resolve(import.meta.dirname, '..');
const BACKEND_PORT = 3101;
const PREVIEW_PORT = 4301;
const CHROME_PORT = 9341;
const DB_NAME = 'noteapp_lighthouse';
const DB_URL = `postgresql://noteapp:noteapp_dev_only@localhost:5432/${DB_NAME}`;
const ORIGIN = `http://localhost:${PREVIEW_PORT}`;
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];

const argValue = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
};
const label = argValue('label', 'run');
const runs = Number(argValue('runs', '1'));
const only = argValue('pages', '').split(',').filter(Boolean);
const outDir = path.join(root, 'lighthouse-reports', label);
mkdirSync(outDir, { recursive: true });

const children = [];
const start = (command, args, env) => {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  children.push(child);
  return child;
};

const waitFor = async (url) => {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not listening yet
    }
    await sleep(500);
  }
  throw new Error(`${url} did not come up`);
};

const prepareDatabase = () => {
  // The container that publishes 5432 is the dev database, whatever the compose project is called
  // (a git worktree gets its own project name).
  const container = spawnSync(
    'docker',
    ['ps', '--filter', 'publish=5432', '--format', '{{.Names}}'],
    {
      encoding: 'utf8',
    },
  ).stdout.split('\n')[0];
  if (!container) throw new Error('The dev Postgres container is not running. Run pnpm db:up.');
  const psql = (sql, db = 'postgres') =>
    spawnSync('docker', ['exec', container, 'psql', '-U', 'noteapp', '-d', db, '-tAc', sql], {
      encoding: 'utf8',
    });
  const exists = psql(`SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'`);
  if (exists.status !== 0)
    throw new Error(`Postgres is not reachable. Run pnpm db:up.\n${exists.stderr}`);
  if (!exists.stdout.trim()) psql(`CREATE DATABASE ${DB_NAME}`);
  const migrate = spawnSync(
    'pnpm',
    ['--filter', 'backend', 'exec', 'prisma', 'migrate', 'deploy'],
    {
      cwd: root,
      env: { ...process.env, DATABASE_URL: DB_URL },
      encoding: 'utf8',
    },
  );
  if (migrate.status !== 0) throw new Error(migrate.stderr || migrate.stdout);
};

const api = async (pathname, { method = 'GET', token, body } = {}) => {
  const response = await fetch(`${ORIGIN}/api/v1${pathname}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(`${method} ${pathname} -> ${response.status}`);
  return response.status === 204 ? null : response.json();
};

const paragraph = (text) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const doc = (...content) => ({ type: 'doc', content });

// A demo user with enough data for a realistic notes list, plus one active share link.
const seed = async () => {
  const email = `lighthouse-${Date.now()}@example.com`;
  const password = 'Lighthouse-demo-1';
  const registered = await api('/auth/register', {
    method: 'POST',
    body: { email, password, displayName: 'Demo User' },
  });
  const token = registered.accessToken;
  const tags = [];
  for (const [name, color] of [
    ['work', '#2563eb'],
    ['ideas', '#16a34a'],
    ['reading', '#9333ea'],
  ]) {
    tags.push(await api('/tags', { method: 'POST', token, body: { name, color } }));
  }
  let first;
  for (let index = 1; index <= 25; index++) {
    const note = await api('/notes', {
      method: 'POST',
      token,
      body: {
        title: `Demo note ${index}: planning and ideas`,
        content: doc(
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Overview' }] },
          paragraph(
            'Spec-driven development keeps the requirements, the design and the code in step. '.repeat(
              4,
            ),
          ),
          {
            type: 'bulletList',
            content: ['First point', 'Second point', 'Third point'].map((text) => ({
              type: 'listItem',
              content: [paragraph(text)],
            })),
          },
        ),
      },
    });
    first ??= note;
    if (index % 3 === 0) {
      await api(`/notes/${note.id}/tags`, {
        method: 'PUT',
        token,
        body: { tagIds: [tags[index % 3].id] },
      });
    }
  }
  const share = await api(`/notes/${first.id}/shares`, { method: 'POST', token, body: {} });
  return { email, password, noteId: first.id, shareToken: share.token };
};

const pages = (data) =>
  [
    { name: 'login', path: '/login', auth: false },
    { name: 'register', path: '/register', auth: false },
    { name: 'public-share', path: `/s/${data.shareToken}`, auth: false },
    { name: 'notes', path: '/notes', auth: true },
    { name: 'note-editor', path: `/notes/${data.noteId}`, auth: true },
  ].filter((entry) => only.length === 0 || only.includes(entry.name));

const median = (results) =>
  [...results].sort(
    (a, b) => a.lhr.categories.performance.score - b.lhr.categories.performance.score,
  )[Math.floor(results.length / 2)];

const audit = async (url, formFactor, beforeRun) => {
  const flags = {
    port: CHROME_PORT,
    output: ['json', 'html'],
    logLevel: 'error',
    onlyCategories: CATEGORIES,
    disableStorageReset: true,
  };
  const results = [];
  for (let run = 0; run < runs; run++) {
    await beforeRun?.();
    results.push(
      await lighthouse(url, flags, formFactor === 'desktop' ? desktopConfig : undefined),
    );
  }
  return median(results);
};

const withBrowser = async (work) => {
  // A persistent context is the browser's default context, the one Lighthouse attaches to over
  // the debugging port, so the login cookie is visible to it. A fresh profile per call keeps
  // the guest and signed-in runs apart.
  const profile = mkdtempSync(path.join(outDir, 'profile-'));
  const context = await chromium.launchPersistentContext(profile, {
    headless: true,
    args: [`--remote-debugging-port=${CHROME_PORT}`],
  });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    return await work(page);
  } finally {
    await context.close();
    rmSync(profile, { recursive: true, force: true });
  }
};

const summary = [];
const record = async (entry, formFactor, url, beforeRun) => {
  const result = await audit(url, formFactor, beforeRun);
  const scores = Object.fromEntries(
    CATEGORIES.map((id) => [id, Math.round((result.lhr.categories[id].score ?? 0) * 100)]),
  );
  const file = `${entry.name}-${formFactor}`;
  const [json, html] = result.report;
  writeFileSync(path.join(outDir, `${file}.json`), json);
  writeFileSync(path.join(outDir, `${file}.html`), html);
  summary.push({ page: entry.name, formFactor, ...scores });
  console.log(file, JSON.stringify(scores));
};

const shutdown = () => {
  for (const child of children) child.kill();
};

try {
  prepareDatabase();
  start('node', ['backend/dist/server.js'], {
    NODE_ENV: 'production',
    PORT: String(BACKEND_PORT),
    DATABASE_URL: DB_URL,
    LOG_LEVEL: 'error',
    JWT_ACCESS_SECRET: 'lighthouse-only-jwt-secret-0123456789-abcdefghij',
    OTP_HMAC_SECRET: 'lighthouse-only-otp-secret-9876543210-jihgfedcba',
    APP_ORIGIN: ORIGIN,
    COOKIE_SECURE: 'true',
    JOBS_ENABLED: 'false',
  });
  start(
    'pnpm',
    [
      '--filter',
      'frontend',
      'exec',
      'vite',
      'preview',
      '--port',
      String(PREVIEW_PORT),
      '--strictPort',
    ],
    {
      VITE_API_PROXY_TARGET: `http://localhost:${BACKEND_PORT}`,
    },
  );
  await waitFor(`http://localhost:${BACKEND_PORT}/api/v1/health`);
  await waitFor(ORIGIN);
  const data = await seed();
  const targets = pages(data);

  // Guest pages first, in a browser with no cookies (the login page redirects a signed-in user).
  await withBrowser(async () => {
    for (const entry of targets.filter((item) => !item.auth)) {
      for (const formFactor of ['mobile', 'desktop']) {
        await record(entry, formFactor, `${ORIGIN}${entry.path}`);
      }
    }
  });

  await withBrowser(async (page) => {
    // The refresh cookie rotates on every page load, and a load that Lighthouse aborts can leave
    // a rotated-away token behind (reuse revokes the whole session). A fresh login before every
    // run keeps each measurement independent.
    const login = async () => {
      await page.context().clearCookies();
      await page.goto(`${ORIGIN}/login`);
      await page.getByLabel('Email').fill(data.email);
      await page.getByLabel('Password').fill(data.password);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await page.waitForURL('**/notes');
    };
    for (const entry of targets.filter((item) => item.auth)) {
      for (const formFactor of ['mobile', 'desktop']) {
        await record(entry, formFactor, `${ORIGIN}${entry.path}`, login);
      }
    }
  });

  writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log('\n| Page | Form factor | Performance | Accessibility | Best practices | SEO |');
  console.log('| --- | --- | --- | --- | --- | --- |');
  for (const row of summary) {
    console.log(
      `| ${row.page} | ${row.formFactor} | ${row.performance} | ${row.accessibility} | ${row['best-practices']} | ${row.seo} |`,
    );
  }
} finally {
  shutdown();
}
