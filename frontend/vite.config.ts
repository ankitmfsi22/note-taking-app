import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { cacheHeaders, inlineCss } from './vite-plugins.ts';

// The repository root holds the single .env (SDS SA-52).
const rootDir = path.resolve(import.meta.dirname, '..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, 'VITE_');
  const proxy = {
    '/api': {
      target: env['VITE_API_PROXY_TARGET'] ?? 'http://localhost:3000',
      changeOrigin: true,
    },
  };
  return {
    envDir: rootDir,
    plugins: [react(), tailwindcss(), inlineCss(), cacheHeaders()],
    resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
    server: { port: 5173, strictPort: true, proxy },
    preview: { proxy },
  };
});
