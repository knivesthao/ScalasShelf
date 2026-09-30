// Test helper: the real API on an in-memory SQLite database (same migrations as D1).

import { createApp } from './app';
import { memoryStore, migrate, sqliteDb } from './local';
import { devAuth, sessionAuth, type Mail, type TextModel } from './platform';
import { sessionEmail } from './services/staff';
import { seedDemo } from './seed';

/**
 * `auth: 'dev'` (default): the x-dev-user header picks the caller (default demo-creator).
 * `auth: 'session'`: real cookie sessions, as in production.
 */
export async function testApi({ seed = true, auth = 'dev' as 'dev' | 'session', text = undefined as TextModel | undefined } = {}) {
  const { db, raw } = sqliteDb(':memory:');
  migrate(raw);
  if (seed) await seedDemo(db);
  // Demo staff so the Studio and review routes can be exercised.
  raw.prepare(`INSERT OR IGNORE INTO staff (email, name, role, created_at) VALUES
    ('demo-creator', 'Demo Creator', 'creator', '2026-01-01'),
    ('demo-reviewer', 'Demo Reviewer', 'reviewer', '2026-01-01'),
    ('writer@example.org', 'Writer', 'creator', '2026-01-01')`).run();
  const sent: Mail[] = [];
  /** Background jobs started by requests; `settle()` waits for them. */
  const pending: Promise<unknown>[] = [];
  const app = createApp({
    db,
    files: memoryStore(),
    auth: auth === 'dev' ? devAuth : sessionAuth((sessionId) => sessionEmail(db, sessionId)),
    mailer: { development: false, send: async (mail) => { sent.push(mail); } },
    workerSecret: 'test-secret',
    text,
    background: (task) => { pending.push(task); },
  });
  const settle = () => Promise.all(pending.splice(0));

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

  return { app, db, raw, call, sent, settle };
}
