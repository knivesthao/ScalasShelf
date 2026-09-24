// Cloudflare Workers entry point. Deploy with `npx wrangler deploy` from api/
// (see api/wrangler.toml). Bindings: DB (D1), FILES (R2, optional until R2 is
// enabled on the account); secret WORKER_SECRET. The same Worker serves the built
// app (dist/) as static assets, so the site and /api share one origin.

import { createApp } from './app';
import { noAuth, type Db, type FileStore } from './platform';

/** The bits of R2's bucket API we use (R2Bucket satisfies this). */
interface R2Like {
  put(key: string, value: ArrayBuffer, options: { httpMetadata: { contentType: string } }): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null>;
  delete(key: string): Promise<void>;
}

interface Bindings {
  DB: Db;
  FILES?: R2Like;
  WORKER_SECRET?: string;
}

/** Until R2 is enabled: uploads fail with a clear message, everything else works. */
const noFiles: FileStore = {
  put: async () => { throw new Error('File storage (R2) is not set up yet'); },
  get: async () => null,
  delete: async () => {},
};

function r2Store(bucket: R2Like): FileStore {
  return {
    put: async (key, body, contentType) => { await bucket.put(key, body, { httpMetadata: { contentType } }); },
    get: async (key) => {
      const obj = await bucket.get(key);
      return obj ? { body: obj.body, contentType: obj.httpMetadata?.contentType ?? 'application/octet-stream' } : null;
    },
    delete: (key) => bucket.delete(key),
  };
}

export default {
  fetch(request: Request, env: Bindings, ctx: unknown) {
    // Built per request because bindings arrive with the request; creating a Hono app is cheap.
    const app = createApp({
      db: env.DB,
      files: env.FILES ? r2Store(env.FILES) : noFiles,
      auth: noAuth, // Replace with the real sign-in once it's chosen.
      workerSecret: env.WORKER_SECRET,
    });
    return app.fetch(request, env, ctx as never);
  },
};
