// Textweaver service worker: keeps the app itself available offline.
// Saved books (data + images) live in IndexedDB (src/lib/offline.ts); this only
// caches the app's own files so it can start without internet.
const CACHE_NAME = 'textweaver-v3';
const APP_SHELL = ['/', '/index.html', '/manifest.json'];

// On a first visit the app's JS/CSS load before this worker takes control, so cache
// them up front: read their hashed names from index.html. Demo covers too, if present.
async function precache() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(APP_SHELL);
  const html = await (await fetch('/index.html', { cache: 'no-cache' })).text();
  const built = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
  await cache.addAll(built);
  try {
    const pack = await (await fetch('/demo-art/pack.json')).json();
    await cache.addAll([...pack.backgrounds, ...pack.characters].map((e) => `/demo-art/${e.file}`));
  } catch {
    // No demo art pack: nothing to add.
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Pages: network first, fall back to the cached app shell.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/')));
    return;
  }

  // Built files and art: serve from cache, fetch and cache on first use.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/demo-art/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return res;
          })
      )
    );
  }
});
