// Reading events (api/src/services/events.ts). track() never blocks or fails: events wait
// in a queue on the phone and go up in batches when there's a connection, so offline
// reading is counted too. Anonymous: a random device id, never a name or account.

const QUEUE_KEY = 'shelf-events';
const DEVICE_KEY = 'shelf-device-id';
const MAX_QUEUED = 500;
const BATCH = 50;
const FLUSH_EVERY_MS = 30_000;
const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'web';
const API_ORIGIN = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export type EventName =
  | 'app_opened' | 'book_opened' | 'book_finished' | 'quiz_finished' | 'word_tapped' | 'shelf_added' | 'book_downloaded';

interface QueuedEvent {
  name: EventName;
  book_id?: string;
  props?: Record<string, unknown>;
  at: string;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked: drop quietly */ }
}

function deviceId(): string {
  let id = read<string | null>(DEVICE_KEY, null);
  if (!id) {
    id = crypto.randomUUID();
    write(DEVICE_KEY, id);
  }
  return id;
}

/** Records an event. Safe to call anywhere; it never throws. */
export function track(name: EventName, bookId?: string, props?: Record<string, unknown>): void {
  const queue = read<QueuedEvent[]>(QUEUE_KEY, []);
  queue.push({ name, ...(bookId ? { book_id: bookId } : {}), ...(props ? { props } : {}), at: new Date().toISOString() });
  // Keep the newest events if the phone has been offline for a very long time.
  write(QUEUE_KEY, queue.slice(-MAX_QUEUED));
}

let flushing = false;

/** Sends queued events. With `beacon`, uses sendBeacon so it survives the page closing. */
export async function flushEvents(beacon = false): Promise<void> {
  if (flushing || !navigator.onLine) return;
  const queue = read<QueuedEvent[]>(QUEUE_KEY, []);
  if (!queue.length) return;
  const batch = queue.slice(0, BATCH);
  const body = JSON.stringify({ device_id: deviceId(), app_version: APP_VERSION, events: batch });
  const url = `${API_ORIGIN}/api/events`;

  if (beacon && navigator.sendBeacon) {
    if (navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))) {
      write(QUEUE_KEY, read<QueuedEvent[]>(QUEUE_KEY, []).slice(batch.length));
    }
    return;
  }

  flushing = true;
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true });
    // 4xx means the batch itself is bad: drop it so it can't block the queue forever.
    if (res.ok || (res.status >= 400 && res.status < 500)) {
      write(QUEUE_KEY, read<QueuedEvent[]>(QUEUE_KEY, []).slice(batch.length));
      if (queue.length > batch.length) setTimeout(() => void flushEvents(), 0);
    }
  } catch {
    // Offline or the server is down: try again later.
  } finally {
    flushing = false;
  }
}

/** Starts sending events: now, every 30 seconds, when back online, and when the app is hidden. */
export function startEventSync(): void {
  track('app_opened');
  void flushEvents();
  setInterval(() => void flushEvents(), FLUSH_EVERY_MS);
  window.addEventListener('online', () => void flushEvents());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushEvents(true);
  });
}
