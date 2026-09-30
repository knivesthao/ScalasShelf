// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { TextModel } from './platform';
import { fillMeanings } from './services/meanings';
import { flushTranslations, queueTranslations, translationStatus, type Translator } from './services/translation';
import { testApi } from './testing';

/** A fake translator that records each request (one per batch). */
function fakeTranslator() {
  const requests: string[][] = [];
  const translator: Translator = {
    name: 'fake/translate',
    translate: async (texts) => { requests.push(texts); return texts.map((t) => `LO:${t}`); },
  };
  return { translator, requests };
}

describe('translation queue', () => {
  it('sends queued texts as one list, caches them, and never translates the same text twice', async () => {
    const { db } = await testApi();
    const { translator, requests } = fakeTranslator();
    expect(await queueTranslations(db, ['Good morning!', 'Noy is late.', 'Good morning!'.trim()], 'en', 'lo')).toBe(2);
    expect(await queueTranslations(db, ['Good morning!'], 'en', 'lo')).toBe(0); // already queued

    await flushTranslations(db, translator);
    expect(requests).toEqual([['Good morning!', 'Noy is late.']]); // one request, no dividers

    // Another book with a sentence that's already translated: nothing new to send.
    expect(await queueTranslations(db, ['Good morning!', 'Thank you!'], 'en', 'lo')).toBe(1);
    await flushTranslations(db, translator);
    expect(requests[1]).toEqual(['Thank you!']);
    const status = await translationStatus(db, ['Good morning!', 'Thank you!'], 'en', 'lo');
    expect(status.texts).toEqual([{ text: 'Good morning!', translation: 'LO:Good morning!' }, { text: 'Thank you!', translation: 'LO:Thank you!' }]);
  });

  it('keeps each batch within Google’s limits (128 texts, about 5,000 characters)', async () => {
    const { db } = await testApi();
    const { translator, requests } = fakeTranslator();
    const texts = Array.from({ length: 300 }, (_, i) => `Sentence number ${i} is here.`);
    await queueTranslations(db, texts, 'en', 'lo');
    await flushTranslations(db, translator);
    expect(requests.every((r) => r.length <= 128)).toBe(true);
    expect(requests.every((r) => r.join('').length <= 5000)).toBe(true);
    expect(requests.flat()).toHaveLength(300);
  });

  it('leaves texts in the queue when the service fails, to try again later', async () => {
    const { db } = await testApi();
    const down: Translator = { name: 'down', translate: async () => { throw new Error('503'); } };
    await queueTranslations(db, ['Hello'], 'en', 'lo');
    await flushTranslations(db, down);
    expect((await translationStatus(db, ['Hello'], 'en', 'lo')).waiting).toBe(1);
  });

  it('queues a book over the API and translates it in the background', async () => {
    const { translator } = fakeTranslator();
    const { call, settle } = await testApi({ translator });
    const start = await call('POST', '/studio/projects/demo-noy/translations', { body: { target: 'lo' } });
    expect(start.status).toBe(202);
    expect(start.json.queued).toBeGreaterThan(0);
    await settle();
    const done = (await call('GET', '/studio/projects/demo-noy/translations?target=lo')).json;
    expect(done.waiting).toBe(0);
    expect(done.done).toBe(done.texts.length);
  });
});

describe('word meanings', () => {
  it('uses the shared dictionary first and asks AI once for the rest', async () => {
    const { db, raw } = await testApi();
    // Take the meanings off Noy's words, and put one in the dictionary.
    for (const row of raw.prepare(`SELECT id, data FROM scenes WHERE project_id = 'demo-noy'`).all() as { id: string; data: string }[]) {
      const data = JSON.parse(row.data);
      data.bubbles.forEach((b: { tokens: { en?: { gloss?: string }[] } }) => b.tokens.en?.forEach((t) => delete t.gloss));
      raw.prepare(`UPDATE scenes SET data = ? WHERE id = ?`).run(JSON.stringify(data), row.id);
    }
    raw.prepare(`INSERT INTO word_meanings (word, level, meaning, source, created_at) VALUES ('buffalo', 'A1', 'a big farm animal', 'writer', '2026-01-01')`).run();

    const prompts: string[] = [];
    const model: TextModel = {
      name: 'fake/model',
      complete: async (_system, prompt) => {
        prompts.push(prompt);
        const n = prompt.split('\n').length;
        return { text: JSON.stringify({ meanings: Array.from({ length: n }, (_, i) => ({ n: i + 1, meaning: `meaning ${i + 1}` })) }) };
      },
    };
    const result = await fillMeanings(db, [{ model, attempts: 1 }], 'demo-creator', 'demo-noy');
    expect(prompts).toHaveLength(1); // one request for the whole book
    expect(prompts[0]).not.toMatch(/buffalo/); // already in the dictionary
    expect(result.from_dictionary).toBe(1);
    expect(result.missing).toEqual([]);

    // The next book asking for the same words doesn't call AI at all.
    const again = await fillMeanings(db, [{ model, attempts: 1 }], 'demo-creator', 'demo-noy');
    expect(prompts).toHaveLength(1);
    expect(again.filled).toBe(0);
  });
});
