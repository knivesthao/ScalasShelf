// Demo books for local development, tests, and the Cloudflare database
// (scripts/seed-remote.ts). Both are published so the library has something to read;
// the book content lives in src/lib/demoContent.ts.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoBooks } from '../../src/lib/demoContent';
import { buildPackage, buildVocab, draftQuiz, readingLevel } from '../../src/lib/format';
import type { DemoPack } from '../../src/lib/stubArt';
import type { Db, Stmt } from './platform';

export const DEMO_CREATOR = 'demo-creator';

const PACK_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'demo-art', 'pack.json');

export function loadPack(): DemoPack | null {
  return existsSync(PACK_PATH) ? (JSON.parse(readFileSync(PACK_PATH, 'utf8')) as DemoPack) : null;
}

/** Statements that insert (or replace) the demo books. */
export function demoStatements(db: Db, pack: DemoPack | null = loadPack()): Stmt[] {
  return demoBooks(pack).flatMap((p) => {
    const quiz = draftQuiz(buildVocab(p.scenes));
    const pkg = buildPackage({ id: p.id, title: p.title, level: p.level }, p.scenes, quiz);
    const cover = pkg.manifest.editions.lite.assets[p.scenes[0].layers[0].asset]?.url ?? null;
    return [
      db.prepare(
        `INSERT OR REPLACE INTO projects (id, creator_id, type, title, description, level, status, quiz, created_at, updated_at)
         VALUES (?, ?, 'comic', ?, ?, ?, 'published', ?, ?, ?)`
      ).bind(p.id, DEMO_CREATOR, p.title, p.description, p.level, JSON.stringify(quiz), p.created_at, p.created_at),
      ...p.scenes.map((s, i) =>
        db.prepare(`INSERT OR REPLACE INTO scenes (id, project_id, scene_number, data, updated_at) VALUES (?, ?, ?, ?, ?)`)
          .bind(`${p.id}-s${i + 1}`, p.id, i + 1, JSON.stringify(s), p.created_at)
      ),
      db.prepare(
        `INSERT OR REPLACE INTO books (id, project_id, creator_id, title, description, level, reading_level, cover_url, manifest, published_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(`book-${p.id}`, p.id, DEMO_CREATOR, p.title, p.description, p.level, readingLevel(p.level), cover, JSON.stringify(pkg), p.created_at, p.created_at),
    ];
  });
}

/** Inserts the demo books if the database has no projects yet. */
export async function seedDemo(db: Db, pack: DemoPack | null = loadPack()): Promise<boolean> {
  const existing = await db.prepare(`SELECT COUNT(*) AS n FROM projects`).first<{ n: number }>();
  if (existing && existing.n > 0) return false;
  await db.batch(demoStatements(db, pack));
  return true;
}
