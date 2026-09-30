import { BadRequest, Forbidden, NotFound } from '../errors';
import type { Db } from '../platform';

/** Jobs the GPU worker does: the Studio can queue these over /render. */
export const JOB_KINDS = ['scene', 'layer', 'package'] as const;
/** Jobs the API runs itself in the background (Scala Finish). The GPU worker never claims them. */
export const API_JOB_KINDS = ['finish'] as const;
export type JobKind = (typeof JOB_KINDS)[number] | (typeof API_JOB_KINDS)[number];

/** A background job still "running" after this long died with its Worker: report it failed. */
const STALE_AFTER_MS = 3 * 60 * 1000;

export interface Job {
  id: string;
  kind: JobKind;
  project_id: string;
  payload: Record<string, unknown>;
  status: 'queued' | 'running' | 'complete' | 'failed';
  result: unknown;
  error: string | null;
}

interface JobRow extends Omit<Job, 'payload' | 'result'> {
  user_id: string;
  payload: string;
  result: string | null;
}

const now = () => new Date().toISOString();

function toJob(row: JobRow): Job {
  return {
    id: row.id,
    kind: row.kind,
    project_id: row.project_id,
    payload: JSON.parse(row.payload),
    status: row.status,
    result: row.result ? JSON.parse(row.result) : null,
    error: row.error,
  };
}

export async function queueJob(db: Db, userId: string, kind: unknown, payload: Record<string, unknown>): Promise<string> {
  if (!(JOB_KINDS as readonly string[]).includes(kind as string)) throw new BadRequest('Unknown job kind');
  const projectId = payload?.project_id;
  if (typeof projectId !== 'string') throw new BadRequest('payload.project_id is required');
  const owner = await db.prepare(`SELECT creator_id FROM projects WHERE id = ?`).bind(projectId).first<{ creator_id: string }>();
  if (!owner) throw new NotFound('Project not found');
  if (owner.creator_id !== userId) throw new Forbidden('Not your project');

  const id = crypto.randomUUID();
  const ts = now();
  await db.prepare(
    `INSERT INTO jobs (id, user_id, project_id, kind, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, userId, projectId, kind, JSON.stringify(payload), ts, ts).run();
  return id;
}

/** A user's own job (the Studio polls this). */
export async function getJob(db: Db, userId: string, jobId: string): Promise<Job> {
  const row = await db.prepare(`SELECT * FROM jobs WHERE id = ?`).bind(jobId).first<JobRow & { updated_at: string }>();
  if (!row || row.user_id !== userId) throw new NotFound('Job not found');
  const stale = (API_JOB_KINDS as readonly string[]).includes(row.kind) && (row.status === 'queued' || row.status === 'running')
    && Date.now() - Date.parse(row.updated_at) > STALE_AFTER_MS;
  if (stale) {
    await db.prepare(`UPDATE jobs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?`)
      .bind('It took too long. Try again.', now(), jobId).run();
    return { ...toJob(row), status: 'failed', error: 'It took too long. Try again.' };
  }
  return toJob(row);
}

/** GPU worker: take the oldest queued job, or null when there's nothing to do. */
export async function claimNextJob(db: Db): Promise<Job | null> {
  const row = await db.prepare(
    `UPDATE jobs SET status = 'running', updated_at = ?
     WHERE id = (SELECT id FROM jobs WHERE status = 'queued' AND kind IN ('scene', 'layer', 'package') ORDER BY created_at LIMIT 1)
     RETURNING *`
  ).bind(now()).first<JobRow>();
  return row ? toJob(row) : null;
}

/** GPU worker: finish a running job with a result or an error. */
export async function finishJob(db: Db, jobId: string, outcome: { result?: unknown; error?: string }): Promise<void> {
  const failed = typeof outcome.error === 'string';
  const { meta } = await db.prepare(
    `UPDATE jobs SET status = ?, result = ?, error = ?, updated_at = ? WHERE id = ? AND status = 'running'`
  ).bind(
    failed ? 'failed' : 'complete',
    failed ? null : JSON.stringify(outcome.result ?? null),
    failed ? outcome.error!.slice(0, 1000) : null,
    now(),
    jobId
  ).run();
  if (!meta.changes) throw new NotFound('No running job with that id');
}

// ---- Jobs the API runs itself ----

/**
 * Starts a background job: records it, then runs `work` after the response is sent
 * (Cloudflare's waitUntil; locally the promise just runs). The Studio polls
 * GET /studio/jobs/:id. Its result is whatever `work` returns.
 */
export async function runInBackground(
  db: Db, background: (task: Promise<unknown>) => void,
  job: { userId: string; projectId: string; kind: (typeof API_JOB_KINDS)[number] },
  work: () => Promise<unknown>,
): Promise<string> {
  const id = crypto.randomUUID();
  const ts = now();
  await db.prepare(
    `INSERT INTO jobs (id, user_id, project_id, kind, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'running', ?, ?)`
  ).bind(id, job.userId, job.projectId, job.kind, ts, ts).run();
  background((async () => {
    try {
      const result = await work();
      await db.prepare(`UPDATE jobs SET status = 'complete', result = ?, updated_at = ? WHERE id = ?`)
        .bind(JSON.stringify(result ?? null), now(), id).run();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong';
      await db.prepare(`UPDATE jobs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?`)
        .bind(message.slice(0, 1000), now(), id).run();
    }
  })());
  return id;
}
