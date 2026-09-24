// The three things the API needs from its host, as small interfaces:
//   Db        — Cloudflare D1 in production, SQLite (better-sqlite3) locally
//   FileStore — Cloudflare R2 in production, a folder locally
//   Auth      — who is calling (the sign-in method is decided later; see docs/plans/backend-architecture.md)
// Business logic only ever sees these, never Hono, D1 or R2 directly.

/** The subset of D1's API we use. D1Database satisfies it structurally. */
export interface Db {
  prepare(sql: string): Stmt;
  batch(statements: Stmt[]): Promise<unknown[]>;
}

export interface Stmt {
  bind(...values: unknown[]): Stmt;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}

export interface StoredFile {
  body: ReadableStream | ArrayBuffer | Uint8Array;
  contentType: string;
}

export interface FileStore {
  put(key: string, body: ArrayBuffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredFile | null>;
  delete(key: string): Promise<void>;
}

export interface Auth {
  /** The signed-in user's id, or null for anonymous readers. */
  userId(request: Request): Promise<string | null>;
}

export interface Platform {
  db: Db;
  files: FileStore;
  auth: Auth;
  /** Shared secret the GPU worker uses to claim and finish jobs. */
  workerSecret?: string;
}

// ---- Auth placeholders until the sign-in method is chosen ----

/** Local development only: every request is the demo creator (or the x-dev-user header). */
export const devAuth: Auth = {
  async userId(request) {
    return request.headers.get('x-dev-user') || 'demo-creator';
  },
};

/** Production until real sign-in exists: everyone is an anonymous reader. */
export const noAuth: Auth = {
  async userId() {
    return null;
  },
};
