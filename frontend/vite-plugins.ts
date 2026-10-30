import type { Plugin } from 'vite';

// The stylesheet blocks first paint, and it is small, so the production build inlines it into
// index.html and drops the extra round trip.
export const inlineCss = (): Plugin => ({
  name: 'note-app:inline-css',
  apply: 'build',
  enforce: 'post',
  transformIndexHtml: {
    order: 'post',
    handler(html, ctx) {
      const bundle = ctx.bundle;
      if (!bundle) return html;
      return html.replace(
        /<link rel="stylesheet"[^>]*href="\/(assets\/[^"]+\.css)"[^>]*>/g,
        (tag, file: string) => {
          const asset = bundle[file];
          if (asset?.type !== 'asset') return tag;
          return `<style>${String(asset.source)}</style>`;
        },
      );
    },
  },
});

export const IMMUTABLE = 'public, max-age=31536000, immutable';

// Hashed files under /assets never change, so browsers may keep them for a year. The HTML and the
// other static files must always be revalidated. The API sets its own headers.
export const cacheControlFor = (url: string): string | null => {
  if (url.startsWith('/api/')) return null;
  return url.startsWith('/assets/') ? IMMUTABLE : 'no-cache';
};

// `vite preview` is how the production build is served (the backend serves only the API), so the
// headers are set here. Compression comes from preview itself.
export const cacheHeaders = (): Plugin => ({
  name: 'note-app:cache-headers',
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => {
      const value = cacheControlFor(req.url ?? '');
      if (value) res.setHeader('Cache-Control', value);
      next();
    });
  },
});
