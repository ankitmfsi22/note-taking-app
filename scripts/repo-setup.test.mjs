import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const readJson = (path) => JSON.parse(read(path));

const PACKAGES = ['backend', 'frontend', 'packages/shared'];
const MANIFESTS = ['package.json', ...PACKAGES.map((dir) => `${dir}/package.json`)];

test('S-AB1001-10: docker-compose pins a PostgreSQL 16.x image for the dev and test databases', () => {
  const compose = read('docker-compose.yml');
  const images = [...compose.matchAll(/^\s+image:\s*(\S+)\s*$/gm)].map((match) => match[1]);
  assert.equal(images.length, 2);
  for (const image of images) assert.match(image, /^postgres:16\.\d+(?:\.\d+)?-[a-z]+$/);
  assert.match(compose, /^ {2}db-dev:/m);
  assert.match(compose, /^ {2}db-test:/m);
});

test('S-AB1001-11: the pnpm workspace contains backend, frontend and packages/shared', () => {
  const workspace = read('pnpm-workspace.yaml');
  const block = workspace.split(/^packages:\n/m)[1]?.split(/^\S/m)[0] ?? '';
  const globs = [...block.matchAll(/^ {2}- (\S+)$/gm)].map((match) => match[1]);
  for (const glob of ['backend', 'frontend', 'packages/*']) assert.ok(globs.includes(glob), glob);

  const names = PACKAGES.map((dir) => readJson(`${dir}/package.json`).name);
  assert.deepEqual(names, ['backend', 'frontend', '@note-app/shared']);
});

test('S-AB1001-12: every tool and dependency version is exact, with no ranges and no @latest', () => {
  const EXACT = /^\d+\.\d+\.\d+(?:-[\w.]+)?$/;
  for (const manifest of MANIFESTS) {
    const json = readJson(manifest);
    for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      for (const [name, version] of Object.entries(json[section] ?? {})) {
        assert.ok(
          version === 'workspace:*' || EXACT.test(version),
          `${manifest}: ${name}@${version}`,
        );
      }
    }
    for (const [script, command] of Object.entries(json.scripts ?? {})) {
      assert.ok(!command.includes('@latest'), `${manifest}: script ${script} uses @latest`);
    }
  }
  assert.match(readJson('package.json').packageManager, /^pnpm@\d+\.\d+\.\d+$/);
  assert.match(read('pnpm-workspace.yaml'), /^savePrefix: ''$/m);
  assert.match(read('.nvmrc'), /^\d+\.\d+\.\d+\s*$/);
});

test('S-AB1001-13: the root build runs the shared package before the packages that depend on it', () => {
  const result = spawnSync(
    'pnpm',
    [
      '-r',
      '--workspace-concurrency=1',
      'exec',
      'node',
      '-p',
      'JSON.parse(require("fs").readFileSync("package.json","utf8")).name',
    ],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  const order = result.stdout.split('\n').map((line) => line.trim());

  for (const dir of PACKAGES) {
    const manifest = readJson(`${dir}/package.json`);
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      if (!dependency.startsWith('@note-app/')) continue;
      assert.ok(
        order.includes(dependency) && order.includes(manifest.name),
        `${dir} and ${dependency}`,
      );
      assert.ok(
        order.indexOf(dependency) < order.indexOf(manifest.name),
        `${dependency} before ${manifest.name}`,
      );
    }
  }
  assert.equal(readJson('package.json').scripts.build, 'pnpm -r run build');
});

test('S-AB1001-14: every package with tests enforces an 80% coverage threshold', () => {
  for (const dir of PACKAGES) {
    const config = read(`${dir}/vitest.config.ts`);
    assert.match(config, /provider:\s*'v8'/, dir);
    assert.match(
      config,
      /thresholds:\s*\{\s*lines:\s*80,\s*functions:\s*80,\s*branches:\s*80,\s*statements:\s*80\s*\}/,
      dir,
    );
    assert.equal(readJson(`${dir}/package.json`).scripts.test, 'vitest run', dir);
  }
});

const COMMANDS = [
  'spec',
  'sdd-plan',
  'sdd-tasks',
  'implement',
  'parallel',
  'sdd-review',
  'pr',
  'approve',
];
const SECRET_PATTERNS = [
  /(?:api[_-]?key|secret|password|passwd|token)["']?\s*[:=]\s*["'][^"'\s]{8,}["']/i,
  /\bsk-[A-Za-z0-9]{20,}/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/,
];

test('S-AB1001-24: Context7 is configured in .mcp.json and the committed .claude setup has no secrets', () => {
  const mcp = readJson('.mcp.json');
  const context7 = mcp.mcpServers.context7;
  assert.equal(context7.command, 'pnpm');
  assert.deepEqual(context7.args, ['exec', 'context7-mcp']);
  for (const [name, server] of Object.entries(mcp.mcpServers)) {
    assert.equal(server.env, undefined, `${name} must not carry env values`);
    assert.equal(server.headers, undefined, `${name} must not carry headers`);
  }
  assert.match(
    readJson('package.json').devDependencies['@upstash/context7-mcp'],
    /^\d+\.\d+\.\d+$/,
  );

  for (const command of COMMANDS)
    assert.ok(existsSync(join(root, `.claude/commands/${command}.md`)), command);
  for (const agent of ['reviewer', 'test-writer'])
    assert.ok(existsSync(join(root, `.claude/agents/${agent}.md`)), agent);
  assert.ok(existsSync(join(root, '.claude/settings.json')));

  const files = [
    '.mcp.json',
    ...readdirSync(join(root, '.claude'), { recursive: true })
      .map((path) => join('.claude', path))
      .filter((path) => statSync(join(root, path)).isFile()),
  ];
  for (const file of files) {
    for (const pattern of SECRET_PATTERNS)
      assert.doesNotMatch(read(file), pattern, `${file} looks like it holds a secret`);
  }
});

test('S-AB1001-25: AGENTS.md, CLAUDE.md and the three layer CLAUDE.md files exist within their line limits', () => {
  const limits = {
    'AGENTS.md': 200,
    'CLAUDE.md': 100,
    'backend/CLAUDE.md': 50,
    'frontend/CLAUDE.md': 50,
    'packages/shared/CLAUDE.md': 50,
  };
  for (const [file, limit] of Object.entries(limits)) {
    assert.ok(existsSync(join(root, file)), `${file} is missing`);
    const lines = read(file).trimEnd().split('\n').length;
    assert.ok(lines < limit, `${file} has ${lines} lines, the limit is under ${limit}`);
  }
  assert.equal(read('CLAUDE.md').split('\n')[1], '@AGENTS.md');
});
