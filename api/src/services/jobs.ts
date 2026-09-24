import { BadRequest, Forbidden, NotFound } from '../errors';
import type { Db } from '../platform';

export const JOB_KINDS = ['scene', 'layer', 'package'] as const;
export type JobKind = (typeof JOB_KINDS)[number];

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
  if (!JOB_KINDS.includes(kind as JobKind)) throw new BadRequest('Unknown job kind');
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
  const row = await db.prepare(`SELECT * FROM jobs WHERE id = ?`).bind(jobId).first<JobRow>();
  if (!row || row.user_id !== userId) throw new NotFound('Job not found');
  return toJob(row);
}

/** GPU worker: take the oldest queued job, or null when there's nothing to do. */
export async function claimNextJob(db: Db): Promise<Job | null> {
  const row = await db.prepare(
    `UPDATE jobs SET status = 'running', updated_at = ?
     WHERE id = (SELECT id FROM jobs WHERE status = 'queued' ORDER BY created_at LIMIT 1)
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
