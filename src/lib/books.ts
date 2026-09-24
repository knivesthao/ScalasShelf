// The public library, read from the API — or from this device when offline.

import { api } from './api';
import type { Level, Package } from './format';
import { getSavedBook } from './offline';

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

export function listBooks(level?: Level): Promise<BookCard[]> {
  return api.get<BookCard[]>(`/books${level ? `?level=${level}` : ''}`);
}

/** A saved copy wins, so saved books open instantly and without internet. */
export async function loadBook(id: string): Promise<{ book: Book; saved: boolean }> {
  const saved = await getSavedBook(id).catch(() => null);
  if (saved) return { book: saved.book, saved: true };
  return { book: await api.get<Book>(`/books/${id}`), saved: false };
}

/** Rough download size of the Lite edition's images, when the package knows it. */
export function bookBytes(book: Book): number | null {
  const assets = Object.values(book.package.manifest.editions.lite.assets);
  if (!assets.length || assets.some((a) => !a.bytes)) return null;
  return assets.reduce((sum, a) => sum + (a.bytes ?? 0), 0);
}

export function formatBytes(n: number): string {
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}
