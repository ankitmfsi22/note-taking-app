import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cacheControlFor, IMMUTABLE } from '../vite-plugins';

const frontendDir = path.resolve(import.meta.dirname, '..');
const read = (file: string) => readFileSync(path.join(frontendDir, file), 'utf8');

describe('static assets and headers', () => {
  it('S-AB1016-17: index.html and robots.txt carry the SEO basics', () => {
    const html = read('index.html');
    expect(html).toMatch(/<html lang="en">/);
    expect(html).toMatch(/<meta name="viewport"/);
    expect(html).toMatch(/<meta\s+name="description"\s+content="[^"]{50,}"/);
    expect(html).toMatch(/<meta name="theme-color"/);
    expect(html).toMatch(/<link rel="icon"/);
    expect(html).toMatch(/rel="preload"\s+as="font"[\s\S]*?geist-latin-wght-normal\.woff2/);
    expect(html.match(/<title>/g)).toHaveLength(1);

    const robots = read('public/robots.txt');
    for (const route of ['/notes', '/shares', '/s/']) {
      expect(robots).toContain(`Disallow: ${route}`);
    }
    expect(robots).not.toMatch(/^Disallow: \/login/m);
  });

  it('S-AB1016-25: hashed assets are immutable and the HTML is revalidated', () => {
    expect(IMMUTABLE).toBe('public, max-age=31536000, immutable');
    expect(cacheControlFor('/assets/index-CXBcvjVs.js')).toBe(IMMUTABLE);
    expect(cacheControlFor('/')).toBe('no-cache');
    expect(cacheControlFor('/notes/abc')).toBe('no-cache');
    expect(cacheControlFor('/robots.txt')).toBe('no-cache');
    expect(cacheControlFor('/api/v1/health')).toBeNull();
  });
});
