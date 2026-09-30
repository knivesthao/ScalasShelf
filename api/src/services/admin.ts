// The admin view (Studio → profile → Admin): what making books costs (Scala's tokens and
// time), how long books take from first draft to Scala's Shelf, and how they're read.

import { NotFound } from '../errors';
import type { Db } from '../platform';

/**
 * Estimated price per million tokens, in US dollars, by model (ai_usage.model).
 * Update from the provider's price page when prices change:
 * https://developers.cloudflare.com/workers-ai/platform/pricing/ (checked 2026-09-30).
 * Workers AI also gives a free daily allowance, so real spend can be lower.
 */
export const PRICES_PER_MILLION: Record<string, { input: number; output: number }> = {
  'workers-ai/@cf/meta/llama-3.1-8b-instruct': { input: 0.282, output: 0.827 },
};

interface ModelTokens { model: string; input_tokens: number; output_tokens: number }

/** Estimated cost of token counts, or null when a model has no price set. */
export function estimateCost(rows: ModelTokens[]): number | null {
  let total = 0;
  for (const r of rows) {
    const price = PRICES_PER_MILLION[r.model];
    if (!price) {
      if (r.input_tokens || r.output_tokens) return null;
      continue;
    }
    total += (r.input_tokens * price.input + r.output_tokens * price.output) / 1_000_000;
  }
  return Math.round(total * 10_000) / 10_000;
}

const sinceClause = (since: string | null, column: string) => (since ? `AND ${column} >= ?` : '');
const withSince = <T extends { bind: (...v: unknown[]) => T }>(stmt: T, since: string | null) => (since ? stmt.bind(since) : stmt);
const cleanSince = (since?: string) => (since && Number.isFinite(Date.parse(since)) ? new Date(since).toISOString() : null);

export async function adminOverview(db: Db, rawSince?: string) {
  const since = cleanSince(rawSince);
  const books = await db.prepare(
    `SELECT COUNT(*) AS total,
       SUM(status = 'published') AS published,
       SUM(review_status = 'in_review') AS in_review,
       SUM(status = 'draft' AND review_status != 'in_review') AS drafts
     FROM projects`
  ).first<{ total: number; published: number; in_review: number; drafts: number }>();

  const byTask = (await withSince(db.prepare(
    `SELECT task, model, COUNT(*) AS calls, SUM(1 - ok) AS failed,
       COALESCE(SUM(input_tokens), 0) AS input_tokens, COALESCE(SUM(output_tokens), 0) AS output_tokens,
       COALESCE(SUM(ms), 0) AS ms
     FROM ai_usage WHERE 1 = 1 ${sinceClause(since, 'created_at')} GROUP BY task, model ORDER BY calls DESC`
  ), since).all<ModelTokens & { task: string; calls: number; failed: number; ms: number }>()).results;

  // Per book: only books Scala has worked on count towards the averages.
  const perBook = (await withSince(db.prepare(
    `SELECT project_id, model, COALESCE(SUM(input_tokens), 0) AS input_tokens, COALESCE(SUM(output_tokens), 0) AS output_tokens,
       COALESCE(SUM(ms), 0) AS ms
     FROM ai_usage WHERE project_id IS NOT NULL ${sinceClause(since, 'created_at')} GROUP BY project_id, model`
  ), since).all<ModelTokens & { project_id: string; ms: number }>()).results;
  const projects = new Map<string, (ModelTokens & { ms: number })[]>();
  for (const r of perBook) projects.set(r.project_id, [...(projects.get(r.project_id) ?? []), r]);
  const costs = [...projects.values()].map(estimateCost).filter((c): c is number => c !== null);
  const aiSeconds = [...projects.values()].map((rows) => rows.reduce((s, r) => s + r.ms, 0) / 1000);
  const avg = (list: number[]) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);

  const timing = await db.prepare(
    `SELECT
       AVG(CASE WHEN submitted_at IS NOT NULL THEN (julianday(submitted_at) - julianday(created_at)) * 24 END) AS hours_to_submit,
       AVG(CASE WHEN status = 'published' AND reviewed_at IS NOT NULL AND submitted_at IS NOT NULL
                THEN (julianday(reviewed_at) - julianday(submitted_at)) * 24 END) AS hours_in_review
     FROM projects`
  ).first<{ hours_to_submit: number | null; hours_in_review: number | null }>();

  const reading = await withSince(db.prepare(
    `SELECT COUNT(DISTINCT device_id) AS readers, SUM(name = 'book_opened') AS opens, SUM(name = 'book_finished') AS finishes
     FROM events WHERE 1 = 1 ${sinceClause(since, 'occurred_at')}`
  ), since).first<{ readers: number; opens: number | null; finishes: number | null }>();

  const totals = byTask.reduce(
    (t, r) => ({ calls: t.calls + r.calls, failed: t.failed + r.failed, input_tokens: t.input_tokens + r.input_tokens, output_tokens: t.output_tokens + r.output_tokens, ms: t.ms + r.ms }),
    { calls: 0, failed: 0, input_tokens: 0, output_tokens: 0, ms: 0 },
  );
  return {
    since,
    books: { total: books?.total ?? 0, published: books?.published ?? 0, in_review: books?.in_review ?? 0, drafts: books?.drafts ?? 0 },
    ai: { ...totals, estimated_cost: estimateCost(byTask), by_task: byTask.map((r) => ({ ...r, estimated_cost: estimateCost([r]) })) },
    per_book: {
      books_with_ai: projects.size,
      avg_estimated_cost: avg(costs),
      avg_ai_seconds: avg(aiSeconds),
      avg_hours_to_submit: timing?.hours_to_submit ?? null,
      avg_hours_in_review: timing?.hours_in_review ?? null,
    },
    reading: { readers: reading?.readers ?? 0, opens: reading?.opens ?? 0, finishes: reading?.finishes ?? 0 },
  };
}

export interface AdminBookRow {
  id: string;
  title: string;
  creator_id: string;
  purpose: string;
  status: string;
  review_status: string;
  created_at: string;
  ai_calls: number;
  input_tokens: number;
  output_tokens: number;
  ai_seconds: number;
  estimated_cost: number | null;
  opens: number;
  readers: number;
}

/** Every book with what Scala spent on it and how often it's been read. */
export async function adminBooks(db: Db): Promise<AdminBookRow[]> {
  const { results } = await db.prepare(
    `SELECT p.id, p.title, p.creator_id, p.purpose, p.status, p.review_status, p.created_at,
       (SELECT COUNT(*) FROM ai_usage u WHERE u.project_id = p.id) AS ai_calls,
       (SELECT COALESCE(SUM(ms), 0) FROM ai_usage u WHERE u.project_id = p.id) AS ai_ms,
       (SELECT COUNT(*) FROM events e JOIN books b ON b.id = e.book_id WHERE b.project_id = p.id AND e.name = 'book_opened') AS opens,
       (SELECT COUNT(DISTINCT e.device_id) FROM events e JOIN books b ON b.id = e.book_id WHERE b.project_id = p.id AND e.name = 'book_opened') AS readers
     FROM projects p ORDER BY p.created_at DESC`
  ).all<Omit<AdminBookRow, 'input_tokens' | 'output_tokens' | 'ai_seconds' | 'estimated_cost'> & { ai_ms: number }>();
  const tokens = (await db.prepare(
    `SELECT project_id, model, COALESCE(SUM(input_tokens), 0) AS input_tokens, COALESCE(SUM(output_tokens), 0) AS output_tokens
     FROM ai_usage WHERE project_id IS NOT NULL GROUP BY project_id, model`
  ).all<ModelTokens & { project_id: string }>()).results;
  return results.map(({ ai_ms, ...row }) => {
    const mine = tokens.filter((t) => t.project_id === row.id);
    return {
      ...row,
      input_tokens: mine.reduce((s, t) => s + t.input_tokens, 0),
      output_tokens: mine.reduce((s, t) => s + t.output_tokens, 0),
      ai_seconds: ai_ms / 1000,
      estimated_cost: estimateCost(mine),
    };
  });
}

/** One book: its timeline, Scala's work on it by task, the latest calls, and reading. */
export async function adminBook(db: Db, projectId: string) {
  const project = await db.prepare(
    `SELECT p.id, p.title, p.creator_id, p.purpose, p.level, p.status, p.review_status, p.created_at, p.updated_at,
       p.submitted_at, p.reviewed_at, p.reviewed_by, b.id AS book_id, b.published_at,
       (SELECT COUNT(*) FROM scenes s WHERE s.project_id = p.id) AS scenes
     FROM projects p LEFT JOIN books b ON b.project_id = p.id WHERE p.id = ?`
  ).bind(projectId).first<Record<string, unknown> & { book_id: string | null }>();
  if (!project) throw new NotFound('Book not found');
  const byTask = (await db.prepare(
    `SELECT task, model, COUNT(*) AS calls, SUM(1 - ok) AS failed,
       COALESCE(SUM(input_tokens), 0) AS input_tokens, COALESCE(SUM(output_tokens), 0) AS output_tokens, COALESCE(SUM(ms), 0) AS ms
     FROM ai_usage WHERE project_id = ? GROUP BY task, model ORDER BY calls DESC`
  ).bind(projectId).all<ModelTokens & { task: string; calls: number; failed: number; ms: number }>()).results;
  const calls = (await db.prepare(
    `SELECT task, model, user_id, input_tokens, output_tokens, ms, ok, created_at FROM ai_usage WHERE project_id = ? ORDER BY id DESC LIMIT 50`
  ).bind(projectId).all()).results;
  const reading = project.book_id
    ? await db.prepare(
      `SELECT SUM(name = 'book_opened') AS opens, COUNT(DISTINCT CASE WHEN name = 'book_opened' THEN device_id END) AS readers,
         SUM(name = 'book_finished') AS finishes, SUM(name = 'quiz_finished') AS quizzes,
         AVG(CASE WHEN name = 'quiz_finished' AND json_extract(props, '$.total') > 0
                  THEN 1.0 * json_extract(props, '$.score') / json_extract(props, '$.total') END) AS avg_quiz_score
       FROM events WHERE book_id = ?`
    ).bind(project.book_id).first()
    : null;
  return {
    project,
    ai: { estimated_cost: estimateCost(byTask), by_task: byTask.map((r) => ({ ...r, estimated_cost: estimateCost([r]) })), calls },
    reading,
  };
}
