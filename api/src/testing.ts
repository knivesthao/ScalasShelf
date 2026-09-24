// Test helper: the real API on an in-memory SQLite database (same migrations as D1).

import { createApp } from './app';
import { memoryStore, migrate, sqliteDb } from './local';
import { devAuth } from './platform';
import { seedDemo } from './seed';

export async function testApi({ seed = true } = {}) {
  const { db, raw } = sqliteDb(':memory:');
  migrate(raw);
  if (seed) await seedDemo(db);
  const app = createApp({ db, files: memoryStore(), auth: devAuth, workerSecret: 'test-secret' });

  /** Call the API as a user (default: the demo creator). */
  async function call(method: string, path: string, opts: { body?: unknown; user?: string; headers?: Record<string, string>; raw?: BodyInit } = {}) {
    const headers: Record<string, string> = { ...opts.headers };
    if (opts.user) headers['x-dev-user'] = opts.user;
    let body: BodyInit | undefined = opts.raw;
    if (opts.body !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }
    const res = await app.request(`/api${path}`, { method, headers, body });
    const text = await res.text();
    let json: unknown = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return { status: res.status, json: json as any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  return { app, db, raw, call };
}
