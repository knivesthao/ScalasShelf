// Reading events: the app queues them (offline too) and sends them in batches. They feed
// the pilot's progress reports: books opened and finished, quiz scores, words looked up.
// Children never sign in, so events are anonymous: a random device id, no personal data.

import { BadRequest } from '../errors';
import type { Db } from '../platform';

/** The only events the API accepts. Add a name here before the app sends it. */
export const EVENT_NAMES = [
  'app_opened',
  'book_opened',
  'book_finished',
  'quiz_finished',
  'word_tapped',
  'shelf_added',
  'book_downloaded',
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

export interface IncomingEvent {
  name: string;
  book_id?: string | null;
  props?: Record<string, unknown>;
  /** When it happened on the device (ISO time). */
  at?: string;
}

export interface EventBatch {
  device_id: string;
  app_version?: string;
  events: IncomingEvent[];
}

const MAX_BATCH = 50;
const MAX_PROPS_BYTES = 1024;
/** Device clocks can be wrong; anything more than a day ahead is stored as "now". */
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;
const ID = /^[\w-]{8,64}$/;

/** Stores a batch. Bad events are skipped rather than failing the batch, so one bug can't lose the rest. */
export async function recordEvents(db: Db, batch: EventBatch): Promise<{ stored: number }> {
  if (!batch || typeof batch.device_id !== 'string' || !ID.test(batch.device_id)) throw new BadRequest('Invalid device id');
  if (!Array.isArray(batch.events)) throw new BadRequest('Expected { device_id, events: [...] }');
  if (batch.events.length > MAX_BATCH) throw new BadRequest(`Send at most ${MAX_BATCH} events at a time`);

  const now = Date.now();
  const receivedAt = new Date(now).toISOString();
  const appVersion = typeof batch.app_version === 'string' ? batch.app_version.slice(0, 32) : '';
  const statements = batch.events.flatMap((e) => {
    if (!e || !(EVENT_NAMES as readonly string[]).includes(e.name)) return [];
    const bookId = typeof e.book_id === 'string' && ID.test(e.book_id) ? e.book_id : null;
    const props = JSON.stringify(e.props && typeof e.props === 'object' && !Array.isArray(e.props) ? e.props : {});
    if (props.length > MAX_PROPS_BYTES) return [];
    const at = typeof e.at === 'string' ? Date.parse(e.at) : NaN;
    const occurredAt = new Date(Number.isFinite(at) && at < now + MAX_CLOCK_SKEW_MS ? at : now).toISOString();
    return [
      db.prepare(
        `INSERT INTO events (name, book_id, props, device_id, app_version, occurred_at, received_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(e.name, bookId, props, batch.device_id, appVersion, occurredAt, receivedAt),
    ];
  });
  if (statements.length) await db.batch(statements);
  return { stored: statements.length };
}

export interface BookStats {
  book_id: string;
  title: string | null;
  opened: number;
  finished: number;
  readers: number;
  quizzes: number;
  /** Average quiz score, 0–1, or null with no quizzes. */
  avg_quiz_score: number | null;
}

/** Per-book totals for the admin dashboard (and the funders' progress reports). */
export async function bookStats(db: Db, since?: string): Promise<{ since: string | null; books: BookStats[]; devices: number }> {
  const from = since && Number.isFinite(Date.parse(since)) ? new Date(since).toISOString() : null;
  const time = from ? 'AND e.occurred_at >= ?' : '';
  const bind = <T extends { bind: (...v: unknown[]) => T }>(s: T) => (from ? s.bind(from) : s);
  const { results } = await bind(db.prepare(
    `SELECT e.book_id AS book_id, b.title AS title,
       SUM(e.name = 'book_opened') AS opened,
       SUM(e.name = 'book_finished') AS finished,
       COUNT(DISTINCT CASE WHEN e.name = 'book_opened' THEN e.device_id END) AS readers,
       SUM(e.name = 'quiz_finished') AS quizzes,
       AVG(CASE WHEN e.name = 'quiz_finished' AND json_extract(e.props, '$.total') > 0
                THEN 1.0 * json_extract(e.props, '$.score') / json_extract(e.props, '$.total') END) AS avg_quiz_score
     FROM events e LEFT JOIN books b ON b.id = e.book_id
     WHERE e.book_id IS NOT NULL ${time}
     GROUP BY e.book_id ORDER BY opened DESC`
  )).all<BookStats>();
  const devices = await bind(db.prepare(`SELECT COUNT(DISTINCT device_id) AS n FROM events e WHERE 1 = 1 ${time}`)).first<{ n: number }>();
  return { since: from, books: results, devices: devices?.n ?? 0 };
}
