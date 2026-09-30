// Translation: a queue and a cache in front of Google Cloud Translation (not AI; see
// docs/plans/ai-models.md). Text is queued as books ask for it and sent in batches:
// Google takes a list of texts in one request and returns them in the same order, so no
// dividers are needed. Google charges per character, so batching doesn't lower the
// price; the cache does. A sentence is translated once and reused by every book.

import type { SceneDraft } from '../../../src/lib/format';
import type { Db } from '../platform';

export interface Translator {
  /** Provider and model, for usage tracking, e.g. "google/nmt". */
  name: string;
  /** Translates each text; the answer has one entry per text, in the same order. */
  translate(texts: string[], source: string, target: string): Promise<string[]>;
}

const GOOGLE_URL = 'https://translation.googleapis.com/language/translate/v2';

/** Cloud Translation Basic (v2), with an API key restricted to the Translation API. */
export function googleTranslate(apiKey: string): Translator {
  return {
    name: 'google/nmt',
    async translate(texts, source, target) {
      const res = await fetch(`${GOOGLE_URL}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ q: texts, source, target, format: 'text', model: 'nmt' }),
      });
      if (!res.ok) throw new Error(`Google Translation answered ${res.status}`);
      const data = (await res.json()) as { data?: { translations?: { translatedText: string }[] } };
      const out = data.data?.translations?.map((t) => t.translatedText) ?? [];
      if (out.length !== texts.length) throw new Error('Google Translation returned a different number of texts');
      return out;
    },
  };
}

// Google's limits for one request: at most 128 texts, and it recommends at most 5,000
// characters (https://docs.cloud.google.com/translate/quotas). Past 3 failed tries a text
// stays in the queue with its error, for an admin to look at.
const MAX_TEXTS = 128;
const MAX_CHARS = 5000;
const MAX_ATTEMPTS = 3;
/** Batches sent in one flush, so one run can't take too long. */
const MAX_BATCHES = 10;

export const LANGUAGES = ['en', 'lo'] as const;
export type Language = (typeof LANGUAGES)[number];

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const textHash = (text: string, source: string, target: string) => sha256(`${source}|${target}|${text}`);

/** Every piece of a book's text a reader sees: description, text on screen, lines and word meanings. */
export function bookTexts(description: string, drafts: SceneDraft[]): string[] {
  const all = [
    description,
    ...drafts.flatMap((d) => [
      d.caption ?? '',
      ...d.bubbles.map((b) => b.text.en),
      ...d.bubbles.flatMap((b) => (b.tokens.en ?? []).map((t) => t.gloss ?? '')),
    ]),
  ];
  return [...new Set(all.map((t) => t.trim()).filter(Boolean))];
}

export interface TranslationStatus {
  target: Language;
  /** Each text and its translation, or null while it's still queued. */
  texts: { text: string; translation: string | null }[];
  done: number;
  waiting: number;
  failed: number;
}

/** Looks up a list of texts: what's already translated, what's queued, and what failed. */
export async function translationStatus(db: Db, texts: string[], source: Language, target: Language): Promise<TranslationStatus> {
  const hashes = await Promise.all(texts.map((t) => textHash(t, source, target)));
  const found = new Map<string, string>();
  const queued = new Map<string, number>();
  // D1 limits bound parameters per query, so look up in chunks.
  for (let i = 0; i < hashes.length; i += 50) {
    const chunk = hashes.slice(i, i + 50);
    const marks = chunk.map(() => '?').join(', ');
    const done = await db.prepare(`SELECT hash, translated_text FROM translations WHERE hash IN (${marks})`).bind(...chunk)
      .all<{ hash: string; translated_text: string }>();
    done.results.forEach((r) => found.set(r.hash, r.translated_text));
    const waiting = await db.prepare(`SELECT hash, attempts FROM translation_queue WHERE hash IN (${marks})`).bind(...chunk)
      .all<{ hash: string; attempts: number }>();
    waiting.results.forEach((r) => queued.set(r.hash, r.attempts));
  }
  const failed = [...queued.values()].filter((a) => a >= MAX_ATTEMPTS).length;
  return {
    target,
    texts: texts.map((text, i) => ({ text, translation: found.get(hashes[i]) ?? null })),
    done: found.size,
    waiting: queued.size - failed,
    failed,
  };
}

/** Queues every text that isn't translated or queued yet. Returns how many were added. */
export async function queueTranslations(db: Db, texts: string[], source: Language, target: Language): Promise<number> {
  const status = await translationStatus(db, texts, source, target);
  const missing = status.texts.filter((t) => t.translation === null).map((t) => t.text);
  if (!missing.length) return 0;
  const now = new Date().toISOString();
  const rows = await Promise.all(missing.map(async (text) => ({ text, hash: await textHash(text, source, target) })));
  // Already-queued texts are skipped by the primary key.
  await db.batch(rows.map((r) =>
    db.prepare(`INSERT OR IGNORE INTO translation_queue (hash, source_lang, target_lang, source_text, created_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(r.hash, source, target, r.text, now)));
  return missing.length - status.waiting - status.failed;
}

/**
 * Records a translation batch in ai_usage beside the AI calls, so the admin view shows its
 * cost too. Google charges per character, so input_tokens holds characters (task "translate").
 */
export function translationUsage(db: Db, translator: Translator | undefined) {
  return async (chars: number, ms: number, ok: boolean) => {
    if (!translator) return;
    await db.prepare(
      `INSERT INTO ai_usage (task, model, project_id, user_id, input_tokens, output_tokens, ms, ok, created_at)
       VALUES ('translate', ?, NULL, NULL, ?, 0, ?, ?, ?)`
    ).bind(translator.name, chars, ms, ok ? 1 : 0, new Date().toISOString()).run().catch((e) => console.error('Could not record translation usage', e));
  };
}

/**
 * Sends the queue to the translator in batches (up to 128 texts and 5,000 characters each,
 * one language pair per batch) and stores the results. Called in the background after
 * texts are queued, and by the 5-minute timer for anything left over.
 */
export async function flushTranslations(
  db: Db, translator: Translator | undefined, record?: (chars: number, ms: number, ok: boolean) => Promise<void>,
): Promise<{ translated: number; failed: number }> {
  if (!translator) return { translated: 0, failed: 0 };
  let translated = 0;
  let failed = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const next = await db.prepare(
      `SELECT source_lang, target_lang FROM translation_queue WHERE attempts < ? ORDER BY created_at LIMIT 1`
    ).bind(MAX_ATTEMPTS).first<{ source_lang: string; target_lang: string }>();
    if (!next) break;
    const { results } = await db.prepare(
      `SELECT hash, source_text FROM translation_queue WHERE attempts < ? AND source_lang = ? AND target_lang = ?
       ORDER BY created_at LIMIT ?`
    ).bind(MAX_ATTEMPTS, next.source_lang, next.target_lang, MAX_TEXTS).all<{ hash: string; source_text: string }>();
    // Fill the batch up to the character limit (always at least one text).
    const items: typeof results = [];
    let chars = 0;
    for (const r of results) {
      if (items.length && chars + r.source_text.length > MAX_CHARS) break;
      items.push(r);
      chars += r.source_text.length;
    }

    const started = Date.now();
    try {
      const out = await translator.translate(items.map((i) => i.source_text), next.source_lang, next.target_lang);
      const ts = new Date().toISOString();
      await db.batch(items.flatMap((item, i) => [
        db.prepare(
          `INSERT OR REPLACE INTO translations (hash, source_lang, target_lang, source_text, translated_text, provider, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(item.hash, next.source_lang, next.target_lang, item.source_text, out[i], translator.name, ts),
        db.prepare(`DELETE FROM translation_queue WHERE hash = ?`).bind(item.hash),
      ]));
      translated += items.length;
      await record?.(chars, Date.now() - started, true);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Translation failed';
      console.error('Translation batch failed', e);
      await db.batch(items.map((item) =>
        db.prepare(`UPDATE translation_queue SET attempts = attempts + 1, error = ? WHERE hash = ?`).bind(message.slice(0, 500), item.hash)));
      failed += items.length;
      await record?.(chars, Date.now() - started, false);
      break; // the service is likely down; the timer tries again later
    }
  }
  return { translated, failed };
}
