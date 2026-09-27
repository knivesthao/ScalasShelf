import {
  LEVELS, emptyScene, readingLevel, validatePackage,
  type Cast, type Level, type Package, type QuizItem, type SceneDraft,
} from '../../../src/lib/format';
import { BadRequest, Forbidden, NotFound } from '../errors';
import type { Db } from '../platform';
import { queueJob } from './jobs';

export type ReviewStatus = 'none' | 'in_review' | 'changes_requested';

export interface ProjectCard {
  id: string;
  type: 'comic' | 'book';
  title: string;
  level: Level;
  status: 'draft' | 'published';
  review_status: ReviewStatus;
  created_at: string;
}

export interface Project extends ProjectCard {
  creator_id: string;
  description: string;
  quiz: QuizItem[];
  /** Characters and places, reused across scenes. */
  cast: Cast;
  manifest: Package | null;
  /** The reviewer's note when changes were requested. */
  review_note: string;
  submitted_at: string | null;
  reviewed_at: string | null;
}

/** A book waiting for (or back from) review, as the reviewer sees it. */
export interface ReviewItem {
  project: Project;
  /** The exact book submitted: what children will read once approved. */
  package: Package;
}

export interface Scene {
  id: string;
  scene_number: number;
  data: SceneDraft;
}

interface ProjectRow extends ProjectCard {
  creator_id: string;
  description: string;
  quiz: string;
  cast_json: string;
  manifest: string | null;
  review_note: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  pending_package: string | null;
  updated_at: string;
}

const MAX_SCENE_BYTES = 256 * 1024;
const MAX_CAST_BYTES = 256 * 1024;

function checkCast(value: unknown): string {
  const c = value as Cast;
  const valid = (list: unknown) => Array.isArray(list) && list.every((m) =>
    m && typeof m === 'object' && typeof m.id === 'string' && typeof m.name === 'string' && typeof m.description === 'string');
  if (!c || typeof c !== 'object' || !valid(c.characters) || !valid(c.places)) throw new BadRequest('Invalid cast');
  const json = JSON.stringify({ characters: c.characters, places: c.places });
  if (json.length > MAX_CAST_BYTES) throw new BadRequest('Cast is too large');
  return json;
}
const now = () => new Date().toISOString();
const isLevel = (v: unknown): v is Level => LEVELS.some((l) => l.id === v);

function toProject(row: ProjectRow): Project {
  // The pending package and reviewer id stay server-side; the reviewer reads them via getReviewItem.
  const { pending_package: _pending, reviewed_by: _reviewer, updated_at: _updated, cast_json, ...rest } = row;
  return {
    ...rest,
    quiz: JSON.parse(row.quiz) as QuizItem[],
    cast: JSON.parse(cast_json) as Cast,
    manifest: row.manifest ? (JSON.parse(row.manifest) as Package) : null,
  };
}

async function loadProject(db: Db, projectId: string): Promise<ProjectRow> {
  const row = await db
    .prepare(`SELECT p.*, b.manifest FROM projects p LEFT JOIN books b ON b.project_id = p.id WHERE p.id = ?`)
    .bind(projectId)
    .first<ProjectRow>();
  if (!row) throw new NotFound('Project not found');
  return row;
}

function checkPackage(projectId: string, pkg: Package): void {
  const problems = pkg?.manifest ? validatePackage(pkg) : ['Missing package'];
  if (problems.length) throw new BadRequest(problems.join('; '));
  if (pkg.manifest.id !== projectId) throw new BadRequest('Package is for a different project');
}

function checkTitle(title: unknown): string {
  if (typeof title !== 'string' || !title.trim()) throw new BadRequest('Title is required');
  if (title.length > 200) throw new BadRequest('Title is too long');
  return title.trim();
}

function checkScene(data: unknown): string {
  const d = data as SceneDraft;
  if (!d || typeof d !== 'object' || !Array.isArray(d.layers) || !Array.isArray(d.bubbles)) {
    throw new BadRequest('Invalid scene data');
  }
  const json = JSON.stringify(d);
  if (json.length > MAX_SCENE_BYTES) throw new BadRequest('Scene is too large');
  return json;
}

/** Loads a project the user owns, or throws. */
async function ownProject(db: Db, userId: string, projectId: string): Promise<ProjectRow> {
  const row = await loadProject(db, projectId);
  if (row.creator_id !== userId) throw new Forbidden('Not your project');
  return row;
}

export async function listProjects(db: Db, userId: string): Promise<ProjectCard[]> {
  const { results } = await db
    .prepare(
      `SELECT id, type, title, level, status, review_status, created_at FROM projects WHERE creator_id = ? ORDER BY created_at DESC`
    )
    .bind(userId)
    .all<ProjectCard>();
  return results;
}

export async function createProject(db: Db, userId: string, input: { title?: unknown; level?: unknown }): Promise<Project> {
  const title = checkTitle(input.title);
  const level = isLevel(input.level) ? input.level : 'A1';
  const id = crypto.randomUUID();
  const ts = now();
  await db.batch([
    db.prepare(
      `INSERT INTO projects (id, creator_id, type, title, level, created_at, updated_at) VALUES (?, ?, 'comic', ?, ?, ?, ?)`
    ).bind(id, userId, title, level, ts, ts),
    db.prepare(`INSERT INTO scenes (id, project_id, scene_number, data, updated_at) VALUES (?, ?, 1, ?, ?)`)
      .bind(crypto.randomUUID(), id, JSON.stringify(emptyScene()), ts),
  ]);
  return toProject(await ownProject(db, userId, id));
}

export async function getProject(db: Db, userId: string, projectId: string): Promise<{ project: Project; scenes: Scene[] }> {
  const project = toProject(await ownProject(db, userId, projectId));
  const { results } = await db
    .prepare(`SELECT id, scene_number, data FROM scenes WHERE project_id = ? ORDER BY scene_number`)
    .bind(projectId)
    .all<{ id: string; scene_number: number; data: string }>();
  return {
    project,
    scenes: results.map((r) => ({ id: r.id, scene_number: r.scene_number, data: { ...emptyScene(), ...JSON.parse(r.data) } })),
  };
}

export interface SaveInput {
  project?: { title?: unknown; description?: unknown; level?: unknown; quiz?: unknown; cast?: unknown };
  scenes?: { id: string; data: unknown }[];
}

/** One request saves everything the Studio has pending — cheap on slow connections. */
export async function saveProject(db: Db, userId: string, projectId: string, input: SaveInput): Promise<void> {
  await ownProject(db, userId, projectId);
  const ts = now();
  const statements = [];

  const p = input.project ?? {};
  const sets: string[] = [];
  const values: unknown[] = [];
  if (p.title !== undefined) { sets.push('title = ?'); values.push(checkTitle(p.title)); }
  if (p.description !== undefined) {
    if (typeof p.description !== 'string' || p.description.length > 2000) throw new BadRequest('Invalid description');
    sets.push('description = ?'); values.push(p.description);
  }
  if (p.level !== undefined) {
    if (!isLevel(p.level)) throw new BadRequest('Invalid level');
    sets.push('level = ?'); values.push(p.level);
  }
  if (p.quiz !== undefined) {
    if (!Array.isArray(p.quiz)) throw new BadRequest('Invalid quiz');
    sets.push('quiz = ?'); values.push(JSON.stringify(p.quiz));
  }
  if (p.cast !== undefined) { sets.push('cast_json = ?'); values.push(checkCast(p.cast)); }
  if (sets.length) {
    statements.push(db.prepare(`UPDATE projects SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`).bind(...values, ts, projectId));
  }

  for (const scene of input.scenes ?? []) {
    statements.push(
      db.prepare(`UPDATE scenes SET data = ?, updated_at = ? WHERE id = ? AND project_id = ?`)
        .bind(checkScene(scene.data), ts, scene.id, projectId)
    );
  }
  if (statements.length) await db.batch(statements);
}

export async function addScene(db: Db, userId: string, projectId: string): Promise<Scene> {
  await ownProject(db, userId, projectId);
  const last = await db.prepare(`SELECT MAX(scene_number) AS n FROM scenes WHERE project_id = ?`).bind(projectId).first<{ n: number | null }>();
  const scene: Scene = { id: crypto.randomUUID(), scene_number: (last?.n ?? 0) + 1, data: emptyScene() };
  await db.prepare(`INSERT INTO scenes (id, project_id, scene_number, data, updated_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(scene.id, projectId, scene.scene_number, JSON.stringify(scene.data), now())
    .run();
  return scene;
}

/** Deletes a scene and renumbers the rest so they stay 1..n. */
export async function deleteScene(db: Db, userId: string, sceneId: string): Promise<void> {
  const scene = await db.prepare(`SELECT project_id FROM scenes WHERE id = ?`).bind(sceneId).first<{ project_id: string }>();
  if (!scene) throw new NotFound('Scene not found');
  await ownProject(db, userId, scene.project_id);
  const { results } = await db
    .prepare(`SELECT id FROM scenes WHERE project_id = ? AND id != ? ORDER BY scene_number`)
    .bind(scene.project_id, sceneId)
    .all<{ id: string }>();
  // Ascending order, so each new number is already free.
  await db.batch([
    db.prepare(`DELETE FROM scenes WHERE id = ?`).bind(sceneId),
    ...results.map((r, i) => db.prepare(`UPDATE scenes SET scene_number = ? WHERE id = ?`).bind(i + 1, r.id)),
  ]);
}

/** Puts the episode in the public library and queues the cloud packager. */
/** Puts a package in the public library (used when a reviewer approves). */
async function publishPackage(db: Db, project: ProjectRow, pkg: Package, reviewerId: string): Promise<void> {
  const firstBg = Object.values(pkg.manifest.editions.lite.assets)[0]?.url ?? null;
  const ts = now();
  await db.batch([
    db.prepare(
      `INSERT INTO books (id, project_id, creator_id, title, description, level, reading_level, cover_url, manifest, published_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (project_id) DO UPDATE SET
         title = excluded.title, description = excluded.description, level = excluded.level,
         reading_level = excluded.reading_level, cover_url = excluded.cover_url,
         manifest = excluded.manifest, updated_at = excluded.updated_at`
    ).bind(
      crypto.randomUUID(), project.id, project.creator_id, project.title, project.description, project.level,
      readingLevel(project.level), firstBg, JSON.stringify(pkg), ts, ts
    ),
    db.prepare(
      `UPDATE projects SET status = 'published', review_status = 'none', pending_package = NULL, review_note = '',
         reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`
    ).bind(reviewerId, ts, ts, project.id),
  ]);
  await queueJob(db, project.creator_id, 'package', { project_id: project.id });
}

/**
 * A creator sends a finished book for review. Nothing reaches children until a reviewer
 * approves it (child safeguarding policy: every book is checked by an adult first).
 */
export async function submitForReview(db: Db, userId: string, projectId: string, pkg: Package): Promise<Project> {
  await ownProject(db, userId, projectId);
  checkPackage(projectId, pkg);
  const ts = now();
  await db.prepare(
    `UPDATE projects SET review_status = 'in_review', pending_package = ?, review_note = '',
       submitted_at = ?, updated_at = ? WHERE id = ?`
  ).bind(JSON.stringify(pkg), ts, ts, projectId).run();
  return toProject(await ownProject(db, userId, projectId));
}

/** Books waiting for a reviewer, oldest first. */
export async function listReviewQueue(db: Db): Promise<(ProjectCard & { creator_id: string; submitted_at: string })[]> {
  const { results } = await db.prepare(
    `SELECT id, type, title, level, status, review_status, created_at, creator_id, submitted_at
       FROM projects WHERE review_status = 'in_review' ORDER BY submitted_at`
  ).all<ProjectCard & { creator_id: string; submitted_at: string }>();
  return results;
}

export async function getReviewItem(db: Db, projectId: string): Promise<ReviewItem> {
  const row = await loadProject(db, projectId);
  if (row.review_status !== 'in_review' || !row.pending_package) throw new NotFound('This book isn’t waiting for review');
  return { project: toProject(row), package: JSON.parse(row.pending_package) as Package };
}

/** The reviewer approves: the submitted book goes into the public library. */
export async function approveProject(db: Db, reviewerId: string, projectId: string): Promise<Project> {
  const row = await loadProject(db, projectId);
  if (row.review_status !== 'in_review' || !row.pending_package) throw new BadRequest('This book isn’t waiting for review');
  const pkg = JSON.parse(row.pending_package) as Package;
  checkPackage(projectId, pkg);
  await publishPackage(db, row, pkg, reviewerId);
  return toProject(await loadProject(db, projectId));
}

/** The reviewer sends the book back to its writer with a note. */
export async function requestChanges(db: Db, reviewerId: string, projectId: string, note: unknown): Promise<Project> {
  const row = await loadProject(db, projectId);
  if (row.review_status !== 'in_review') throw new BadRequest('This book isn’t waiting for review');
  const text = typeof note === 'string' ? note.trim() : '';
  if (!text) throw new BadRequest('Add a note so the writer knows what to change');
  if (text.length > 2000) throw new BadRequest('Note is too long');
  const ts = now();
  await db.prepare(
    `UPDATE projects SET review_status = 'changes_requested', pending_package = NULL, review_note = ?,
       reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`
  ).bind(text, reviewerId, ts, ts, projectId).run();
  return toProject(await loadProject(db, projectId));
}

/**
 * Takes the episode out of the library and back to draft. Its writer can do this, and so
 * can reviewers (for example to pull a book quickly if a problem is reported).
 */
export async function unpublishProject(db: Db, projectId: string, actor: { userId: string; isReviewer: boolean }): Promise<Project> {
  const row = await loadProject(db, projectId);
  if (row.creator_id !== actor.userId && !actor.isReviewer) throw new Forbidden('Not your project');
  const ts = now();
  await db.batch([
    db.prepare(`DELETE FROM books WHERE project_id = ?`).bind(projectId),
    db.prepare(`UPDATE projects SET status = 'draft', updated_at = ? WHERE id = ?`).bind(ts, projectId),
  ]);
  return toProject(await loadProject(db, projectId));
}

/** Used by the audio upload route to check the uploader owns the project. */
export async function assertOwnsProject(db: Db, userId: string, projectId: string): Promise<void> {
  await ownProject(db, userId, projectId);
}
