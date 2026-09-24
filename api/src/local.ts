// Local stand-ins for Cloudflare, so the API runs on plain Node (Cloudflare's local
// runtime needs macOS 13.5+). SQLite is the same engine as D1, and the same
// migration files build both databases.

import Database from 'better-sqlite3';
import { mkdirSync, readdirSync, readFileSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Db, FileStore, Stmt } from './platform';

const API_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = join(API_ROOT, 'migrations');

class SqliteStmt implements Stmt {
  constructor(private db: Database.Database, private sql: string, private values: unknown[] = []) {}

  bind(...values: unknown[]): Stmt {
    return new SqliteStmt(this.db, this.sql, values);
  }

  private stmt() {
    return this.db.prepare(this.sql);
  }

  async first<T>(): Promise<T | null> {
    const s = this.stmt();
    return ((s.reader ? s.get(...this.values) : (s.run(...this.values), undefined)) as T | undefined) ?? null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.stmt().all(...this.values) as T[] };
  }

  async run(): Promise<{ meta: { changes: number } }> {
    const s = this.stmt();
    if (s.reader) { s.all(...this.values); return { meta: { changes: 0 } }; }
    return { meta: { changes: s.run(...this.values).changes } };
  }

  /** Synchronous run for batches (D1 batches are transactions). */
  runSync(): void {
    const s = this.stmt();
    if (s.reader) s.all(...this.values);
    else s.run(...this.values);
  }
}

export function sqliteDb(path: string): { db: Db; raw: Database.Database } {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const raw = new Database(path);
  raw.pragma('journal_mode = WAL');
  raw.pragma('foreign_keys = ON'); // D1 enforces foreign keys; SQLite needs asking
  const db: Db = {
    prepare: (sql) => new SqliteStmt(raw, sql),
    batch: async (statements) => {
      raw.transaction(() => statements.forEach((s) => (s as SqliteStmt).runSync()))();
      return [];
    },
  };
  return { db, raw };
}

/** Applies migrations/*.sql not yet recorded, like `wrangler d1 migrations apply`. */
export function migrate(raw: Database.Database): string[] {
  raw.exec(`CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TEXT)`);
  const done = new Set((raw.prepare(`SELECT name FROM d1_migrations`).all() as { name: string }[]).map((r) => r.name));
  const applied: string[] = [];
  for (const name of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(name)) continue;
    raw.transaction(() => {
      raw.exec(readFileSync(join(MIGRATIONS_DIR, name), 'utf8'));
      raw.prepare(`INSERT INTO d1_migrations (name, applied_at) VALUES (?, ?)`).run(name, new Date().toISOString());
    })();
    applied.push(name);
  }
  return applied;
}

/** Files in a local folder, keyed like R2. Content type kept in a sidecar file. */
export function folderStore(root: string): FileStore {
  const pathFor = (key: string) => join(root, ...key.split('/'));
  return {
    async put(key, body, contentType) {
      const path = pathFor(key);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, Buffer.from(body));
      writeFileSync(`${path}.type`, contentType);
    },
    async get(key) {
      const path = pathFor(key);
      if (!existsSync(path)) return null;
      return { body: new Uint8Array(readFileSync(path)), contentType: readFileSync(`${path}.type`, 'utf8') };
    },
    async delete(key) {
      const path = pathFor(key);
      rmSync(path, { force: true });
      rmSync(`${path}.type`, { force: true });
    },
  };
}

/** In-memory files, for tests. */
export function memoryStore(): FileStore {
  const files = new Map<string, { body: Uint8Array; contentType: string }>();
  return {
    put: async (key, body, contentType) => { files.set(key, { body: new Uint8Array(body), contentType }); },
    get: async (key) => files.get(key) ?? null,
    delete: async (key) => { files.delete(key); },
  };
}
