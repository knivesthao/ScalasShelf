// The reader's shelf, and books saved on this device for reading without internet
// (IndexedDB). No account needed: both live on the phone.
//
// The shelf is the reader's own list of books: ones they added, read or downloaded.
// Adding a book only stores its card; downloading also stores the whole book.
//
// A saved book is its package (manifest v2 + text + chunks) plus every image it uses,
// stored as Blobs. Images are keyed by URL and shared between books, and downloads skip
// images already saved, so an interrupted download resumes where it stopped.

import type { Book, BookCard } from './books';

const DB_NAME = 'textweaver-offline';
const DB_VERSION = 2;

export interface ShelfEntry {
  id: string;
  card: BookCard;
  addedAt: string;
}

export interface SavedBook {
  id: string;
  card: BookCard;
  book: Book;
  bytes: number;
  savedAt: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('images')) db.createObjectStore('images');
      if (!db.objectStoreNames.contains('shelf')) db.createObjectStore('shelf', { keyPath: 'id' });
    };
    // Another tab still has the old version open: the upgrade waits until it closes.
    req.onblocked = () => console.warn('Close other Scala’s Shelf tabs to finish updating saved books.');
    req.onsuccess = () => {
      // Let a newer version in another tab upgrade: close this connection and reopen on next use.
      req.result.onversionchange = () => { req.result.close(); dbPromise = null; };
      // Ask the browser not to evict saved books under storage pressure.
      navigator.storage?.persist?.().catch(() => {});
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name: 'books' | 'images' | 'shelf', mode: IDBTransactionMode = 'readonly') {
  return (await openDb()).transaction(name, mode).objectStore(name);
}

/** Every image URL the book's Lite edition uses. */
export function imageUrls(book: Book): string[] {
  return [...new Set(Object.values(book.package.manifest.editions.lite.assets).map((a) => a.url))];
}

/**
 * Saves a book for offline reading. Calls onProgress(done, total) per image.
 * Throws if an image can't be downloaded; what was saved stays, so trying again resumes.
 */
export async function saveBookOffline(book: Book, onProgress?: (done: number, total: number) => void): Promise<SavedBook> {
  const urls = imageUrls(book);
  let bytes = 0;
  for (let i = 0; i < urls.length; i++) {
    const existing = (await wrap((await store('images')).get(urls[i]))) as Blob | undefined;
    if (existing) {
      bytes += existing.size;
    } else {
      const res = await fetch(urls[i]);
      if (!res.ok) throw new Error(`Could not download an image (${res.status})`);
      const blob = await res.blob();
      bytes += blob.size;
      await wrap((await store('images', 'readwrite')).put(blob, urls[i]));
    }
    onProgress?.(i + 1, urls.length);
  }
  const { package: _pkg, ...card } = book;
  const saved: SavedBook = { id: book.id, card, book, bytes, savedAt: new Date().toISOString() };
  await wrap((await store('books', 'readwrite')).put(saved));
  await addToShelf(card);
  return saved;
}

export async function getSavedBook(id: string): Promise<SavedBook | null> {
  return ((await wrap((await store('books')).get(id))) as SavedBook | undefined) ?? null;
}

export async function listSavedBooks(): Promise<SavedBook[]> {
  const all = (await wrap((await store('books')).getAll())) as SavedBook[];
  return all.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** Object URLs for a saved book's images (asset id → blob: URL). Revoke them when done. */
export async function savedImageUrls(book: Book): Promise<Record<string, string>> {
  const images = await store('images');
  const out: Record<string, string> = {};
  for (const [id, asset] of Object.entries(book.package.manifest.editions.lite.assets)) {
    const blob = (await wrap(images.get(asset.url))) as Blob | undefined;
    if (blob) out[id] = URL.createObjectURL(blob);
  }
  return out;
}

/** Removes a book, and any images no other saved book uses. */
export async function removeSavedBook(id: string): Promise<void> {
  await wrap((await store('books', 'readwrite')).delete(id));
  const remaining = await listSavedBooks();
  const stillUsed = new Set(remaining.flatMap((s) => imageUrls(s.book)));
  const images = await store('images', 'readwrite');
  const keys = (await wrap(images.getAllKeys())) as string[];
  await Promise.all(keys.filter((k) => !stillUsed.has(k)).map((k) => wrap(images.delete(k))));
}

/** Adds a book to the reader's shelf. Adding it again keeps its place. */
export async function addToShelf(card: BookCard): Promise<void> {
  const { package: _pkg, ...plain } = card as BookCard & { package?: unknown };
  const existing = (await wrap((await store('shelf')).get(card.id))) as ShelfEntry | undefined;
  const entry: ShelfEntry = { id: card.id, card: plain, addedAt: existing?.addedAt ?? new Date().toISOString() };
  await wrap((await store('shelf', 'readwrite')).put(entry));
}

export async function isOnShelf(id: string): Promise<boolean> {
  return (await wrap((await store('shelf')).get(id))) !== undefined;
}

/**
 * The reader's shelf, newest first, with each book's saved copy if it has one.
 * Books downloaded before the shelf existed count as on the shelf.
 */
export async function listShelf(): Promise<(ShelfEntry & { saved: SavedBook | null })[]> {
  const entries = (await wrap((await store('shelf')).getAll())) as ShelfEntry[];
  const saved = await listSavedBooks();
  const byId = new Map(entries.map((e) => [e.id, e]));
  for (const s of saved) if (!byId.has(s.id)) byId.set(s.id, { id: s.id, card: s.card, addedAt: s.savedAt });
  const savedById = new Map(saved.map((s) => [s.id, s]));
  return [...byId.values()]
    .map((e) => ({ ...e, saved: savedById.get(e.id) ?? null }))
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

/** Takes a book off the shelf, and deletes its saved copy too. */
export async function removeFromShelf(id: string): Promise<void> {
  await wrap((await store('shelf', 'readwrite')).delete(id));
  if (await getSavedBook(id)) await removeSavedBook(id);
}
