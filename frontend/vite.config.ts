import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// The repository root holds the single .env (SDS SA-52).
const rootDir = path.resolve(import.meta.dirname, '..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, 'VITE_');
  return {
    envDir: rootDir,
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: env['VITE_API_PROXY_TARGET'] ?? 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  };
});
