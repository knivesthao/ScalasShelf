import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/**
 * Runs the Hono API (api/) inside the dev server on /api, backed by SQLite in .data/,
 * so `npm run dev` is still one command. Production serves /api from Cloudflare Workers.
 */
function localApi(): Plugin {
  return {
    name: 'scalas-shelf-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        try {
          const { handleApiRequest } = await server.ssrLoadModule('/api/src/devServer.ts');
          await handleApiRequest(req, res);
        } catch (err) {
          next(err);
        }
      });
    },
    // `npm run preview` (the production build, e.g. to test offline mode) gets the API too.
    async configurePreviewServer(server) {
      const { createServer } = await import('vite');
      const loader = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
      const { handleApiRequest } = await loader.ssrLoadModule('/api/src/devServer.ts');
      server.middlewares.use((req, res, next) => (req.url?.startsWith('/api/') ? handleApiRequest(req, res) : next()));
    },
  };
}

export default defineConfig({
  plugins: [react(), localApi()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
