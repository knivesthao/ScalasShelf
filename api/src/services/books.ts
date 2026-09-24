import type { Level, Package } from '../../../src/lib/format';
import { NotFound } from '../errors';
import type { Db } from '../platform';

// The public library. Reading needs no account, so nothing here checks a user.

export interface BookCard {
  id: string;
  title: string;
  description: string;
  level: Level;
  reading_level: string;
  cover_url: string | null;
  published_at: string;
}

export interface Book extends BookCard {
  package: Package;
}

export async function listBooks(db: Db, filter: { level?: string } = {}): Promise<BookCard[]> {
  const where = filter.level ? 'WHERE level = ?' : '';
  const stmt = db.prepare(
    `SELECT id, title, description, level, reading_level, cover_url, published_at FROM books ${where} ORDER BY published_at DESC LIMIT 200`
  );
  const { results } = await (filter.level ? stmt.bind(filter.level) : stmt).all<BookCard>();
  return results;
}

export async function getBook(db: Db, id: string): Promise<Book> {
  const row = await db
    .prepare(`SELECT id, title, description, level, reading_level, cover_url, published_at, manifest FROM books WHERE id = ?`)
    .bind(id)
    .first<BookCard & { manifest: string }>();
  if (!row) throw new NotFound('Book not found');
  const { manifest, ...card } = row;
  return { ...card, package: JSON.parse(manifest) as Package };
}
