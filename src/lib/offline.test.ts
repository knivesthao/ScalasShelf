import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { clearSavedBooks, stubApi, stubObjectUrls, type TestApi } from '@/__tests__/apiStub';
import { api as client } from './api';
import type { Book } from './books';
import { getSavedBook, imageUrls, listSavedBooks, removeSavedBook, saveBookOffline, savedImageUrls } from './offline';

let api: TestApi;
let book: Book;

beforeEach(async () => {
  api = await stubApi();
  stubObjectUrls();
  book = await client.get<Book>('/books/book-demo-market');
});

afterEach(async () => {
  await clearSavedBooks();
  vi.restoreAllMocks();
});

describe('saving books for offline reading', () => {
  it('downloads every image once and reports progress', async () => {
    const progress: number[] = [];
    const saved = await saveBookOffline(book, (done, total) => progress.push(done / total));
    const urls = imageUrls(book);
    expect(urls.length).toBeGreaterThan(1);
    expect(progress[progress.length - 1]).toBe(1);
    expect(saved.bytes).toBe(urls.length * 2048);
    expect((await listSavedBooks()).map((b) => b.card.title)).toEqual(['Morning Market']);
    expect((await getSavedBook(book.id))?.card).not.toHaveProperty('package');
  });

  it('resumes: images already saved are not downloaded again', async () => {
    const urls = imageUrls(book);
    api.fetched.length = 0;
    // Connection drops after the first image.
    let calls = 0;
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (++calls > 1) throw new TypeError('Failed to fetch');
      return realFetch(input, init);
    });
    await expect(saveBookOffline(book)).rejects.toThrow();
    expect(await getSavedBook(book.id)).toBeNull();

    vi.mocked(globalThis.fetch).mockRestore();
    api.fetched.length = 0;
    await saveBookOffline(book);
    expect(api.fetched).toHaveLength(urls.length - 1);
  });

  it('gives the reader local image URLs', async () => {
    await saveBookOffline(book);
    const local = await savedImageUrls(book);
    expect(Object.keys(local).sort()).toEqual(Object.keys(book.package.manifest.editions.lite.assets).sort());
    expect(Object.values(local).every((u) => u.startsWith('blob:'))).toBe(true);
  });

  it('removing a book frees its images', async () => {
    await saveBookOffline(book);
    await removeSavedBook(book.id);
    expect(await listSavedBooks()).toEqual([]);
    api.fetched.length = 0;
    await saveBookOffline(book);
    expect(api.fetched).toHaveLength(imageUrls(book).length); // all downloaded again
  });
});
