// Local API for `npm run dev`: vite.config.ts mounts this on /api inside the Vite
// dev server, so the whole app is still one command. Data lives in .data/ (gitignored);
// delete .data/ to reset to the demo content.

import { getRequestListener } from '@hono/node-server';
import { join } from 'node:path';
import { createApp } from './app';
import { folderStore, migrate, sqliteDb } from './local';
import { consoleMailer, sessionAuth } from './platform';
import { languageTool } from './services/spelling';
import { sessionEmail } from './services/staff';
import { seedDemo } from './seed';

const DATA_DIR = join(process.cwd(), '.data');

const { db, raw } = sqliteDb(join(DATA_DIR, 'textweaver.sqlite'));
const applied = migrate(raw);
if (applied.length) console.log(`[api] applied migrations: ${applied.join(', ')}`);
const ready = seedDemo(db).then((seeded) => { if (seeded) console.log('[api] seeded demo projects'); });

const app = createApp({
  db,
  files: folderStore(join(DATA_DIR, 'files')),
  // Real staff sign-in; links print to the terminal (and the sign-in page shows them).
  auth: sessionAuth((sessionId) => sessionEmail(db, sessionId)),
  mailer: consoleMailer,
  // The real spell checker locally too (it's a free public API).
  spelling: languageTool(),
  secureCookies: false,
  workerSecret: process.env.WORKER_SECRET ?? 'dev-worker-secret',
});

const listener = getRequestListener(async (request) => {
  await ready;
  return app.fetch(request);
});

export const handleApiRequest = listener;
