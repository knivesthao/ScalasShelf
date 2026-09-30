// The things the API needs from its host, as small interfaces:
//   Db        — Cloudflare D1 in production, SQLite (better-sqlite3) locally
//   FileStore — Cloudflare R2 in production, a folder locally
//   Auth      — who is calling: staff sign in by email link (services/staff.ts); readers never do
//   Mailer    — Resend in production; prints to the terminal locally
//   TextModel — an AI text model (Cloudflare Workers AI in production; none locally)
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

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
  /** A development mailer: the API may return sign-in links directly, since nothing is emailed. */
  development?: boolean;
}

/** What a model returns: the text, and token counts when the provider reports them. */
export interface Completion {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
}

/** A text-generation model. services/ai.ts decides which task uses which model. */
export interface TextModel {
  /** Provider and model id, for logs and usage tracking, e.g. "workers-ai/@cf/meta/llama-3.1-8b-instruct". */
  name: string;
  complete(system: string, prompt: string, maxTokens: number): Promise<Completion>;
}

export interface Platform {
  db: Db;
  files: FileStore;
  auth: Auth;
  mailer: Mailer;
  /** Set the session cookie with `Secure` (true everywhere except plain-http local dev). */
  secureCookies?: boolean;
  /** Shared secret the GPU worker uses to claim and finish jobs. */
  workerSecret?: string;
  /** AI text model for Studio suggestions. Without one, suggestions fall back to simple rules. */
  text?: TextModel;
  /** Spell checker for the Review checks (LanguageTool). Without one, spelling is skipped. */
  spelling?: import('./services/spelling').SpellChecker;
  /** Keeps work running after the response is sent (Workers: ctx.waitUntil). Default: just let it run. */
  background?: (task: Promise<unknown>) => void;
}

export const SESSION_COOKIE = 'tw_session';

/** Reads the value of one cookie from a request. */
export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

/** Staff sessions: the session cookie maps to a staff email (services/staff.ts). */
export function sessionAuth(lookup: (sessionId: string | undefined) => Promise<string | null>): Auth {
  return { userId: (request) => lookup(readCookie(request, SESSION_COOKIE)) };
}

/** Local development: prints each email (sign-in links) to the terminal. */
export const consoleMailer: Mailer = {
  development: true,
  async send(mail) {
    console.log(`\n[dev email] to ${mail.to}: ${mail.subject}\n${mail.text}\n`);
  },
};

/** Sends email through Resend's HTTP API (https://resend.com). */
export function resendMailer(apiKey: string, from: string): Mailer {
  return {
    async send({ to, subject, text, html }) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from, to, subject, text, html }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    },
  };
}

/** Until email is configured: sign-in requests fail with a clear message. */
export const noMailer: Mailer = {
  async send() {
    throw new Error('Email is not set up yet (RESEND_API_KEY)');
  },
};

// ---- Auth for tests ----

/** Tests only: every request is the demo creator (or the x-dev-user header). */
export const devAuth: Auth = {
  async userId(request) {
    return request.headers.get('x-dev-user') || 'demo-creator';
  },
};

/** Everyone is an anonymous reader. */
export const noAuth: Auth = {
  async userId() {
    return null;
  },
};
