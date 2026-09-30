// Routes the app's fetch calls into the real API (in-memory SQLite, demo seed) for page
// tests. Image URLs return a tiny fake image, so offline downloads work too.

import { vi } from 'vitest';
import { testApi } from '../../api/src/testing';

export type TestApi = Awaited<ReturnType<typeof testApi>> & {
  /** Simulate losing the connection: every fetch then fails like it would offline. */
  setOnline(online: boolean): void;
  /** URLs fetched so far. */
  fetched: string[];
};

export async function stubApi(): Promise<TestApi> {
  const api = await testApi();
  let online = true;
  const fetched: string[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    fetched.push(url);
    if (!online) throw new TypeError('Failed to fetch');
    if (url.startsWith('/api/')) return api.app.request(url, init as RequestInit);
    if (url.startsWith('/demo-art/') || url.startsWith('data:')) {
      return new Response(new Uint8Array(2048), { headers: { 'content-type': 'image/webp' } });
    }
    throw new Error(`Unexpected fetch ${url}`);
  });
  return { ...api, fetched, setOnline: (v) => { online = v; } };
}

/** jsdom has no object URLs; the reader needs them for saved images. */
export function stubObjectUrls() {
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:test/${++n}`);
  URL.revokeObjectURL = vi.fn();
}

/** Empties this device's saved books between tests (fake-indexeddb). */
export async function clearSavedBooks() {
  const { listShelf, removeFromShelf } = await import('@/lib/offline');
  for (const b of await listShelf()) await removeFromShelf(b.id);
}
