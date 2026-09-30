// Word meanings for a book's new words, in the fewest AI tokens:
// 1. Meanings the writer already typed go into the shared dictionary (word_meanings).
// 2. Missing meanings are looked up in the dictionary, by word and reading level.
// 3. Only the words still missing go to Scala, all in one request as a numbered list
//    (the instructions are sent once, not once per word). Scala's answers are saved to
//    the dictionary, so each word is only ever paid for once per level.

import { bareWord, type Level, type SceneDraft } from '../../../src/lib/format';
import { BadRequest } from '../errors';
import type { Db, TextModel } from '../platform';
import { getProject, saveFinishedBook } from './studio';

const MAX_WORDS = 40;

const MEANINGS_SCHEMA = {
  type: 'object',
  properties: {
    meanings: {
      type: 'array',
      items: { type: 'object', properties: { n: { type: 'integer' }, meaning: { type: 'string' } }, required: ['n', 'meaning'] },
    },
  },
  required: ['meanings'],
};

/** The taught words (tokens marked as new words), with the meaning the writer gave, if any. */
function taughtWords(drafts: SceneDraft[]): Map<string, { meaning: string; example: string }> {
  const words = new Map<string, { meaning: string; example: string }>();
  for (const d of drafts) {
    for (const b of d.bubbles) {
      for (const t of b.tokens.en ?? []) {
        if (!t.v) continue;
        const word = bareWord(t.t);
        const known = words.get(word);
        if (!known || (!known.meaning && t.gloss)) words.set(word, { meaning: (t.gloss ?? '').trim(), example: b.text.en });
      }
    }
  }
  return words;
}

/** Asks one model for all the missing meanings at once; returns word → meaning. */
async function askForMeanings(model: TextModel, level: Level, missing: { word: string; example: string }[]): Promise<Map<string, string>> {
  const system =
    'You write word meanings for children learning English in a reading app. ' +
    `For each numbered word, write a very simple meaning a CEFR ${level} learner understands: at most 10 words, ` +
    'no dictionary style, do not use the word itself. Use the example line for the right sense of the word. ' +
    'Reply with JSON only: {"meanings": [{"n": 1, "meaning": "..."}]}';
  const prompt = missing.map((m, i) => `${i + 1}. ${m.word} — example: "${m.example.slice(0, 160)}"`).join('\n');
  const { text } = await model.complete(system, prompt, 40 + missing.length * 30, { jsonSchema: MEANINGS_SCHEMA });
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  const parsed = json ? (JSON.parse(json) as { meanings?: { n?: unknown; meaning?: unknown }[] }) : {};
  const out = new Map<string, string>();
  for (const m of parsed.meanings ?? []) {
    const n = Number(m?.n);
    const meaning = typeof m?.meaning === 'string' ? m.meaning.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
    if (Number.isInteger(n) && n >= 1 && n <= missing.length && meaning) out.set(missing[n - 1].word, meaning);
  }
  return out;
}

export interface MeaningsResult {
  /** New words that now have a meaning they didn't have before. */
  filled: number;
  from_dictionary: number;
  from_ai: number;
  /** Words still without a meaning (AI not set up, or it couldn't answer). */
  missing: string[];
}

export async function fillMeanings(
  db: Db, models: { model: TextModel; attempts: number }[], userId: string, projectId: string,
): Promise<MeaningsResult> {
  const { project, scenes } = await getProject(db, userId, projectId);
  if (project.purpose === 'reading') throw new BadRequest('Reading books don’t teach new words.');
  const level = project.level;
  const drafts = scenes.map((s) => s.data);
  const words = taughtWords(drafts);
  if (!words.size) throw new BadRequest('Mark some new words first: tap a word in a line.');
  const now = new Date().toISOString();

  // 1. What the writer typed becomes part of the shared dictionary.
  const typed = [...words].filter(([, w]) => w.meaning);
  if (typed.length) {
    await db.batch(typed.map(([word, w]) =>
      db.prepare(`INSERT OR IGNORE INTO word_meanings (word, level, meaning, source, created_at) VALUES (?, ?, ?, 'writer', ?)`)
        .bind(word, level, w.meaning.slice(0, 120), now)));
  }

  // 2. Missing meanings from the dictionary.
  const need = [...words].filter(([, w]) => !w.meaning).map(([word, w]) => ({ word, example: w.example }));
  const meanings = new Map<string, string>();
  for (let i = 0; i < need.length; i += 50) {
    const chunk = need.slice(i, i + 50).map((n) => n.word);
    const { results } = await db.prepare(
      `SELECT word, meaning FROM word_meanings WHERE level = ? AND word IN (${chunk.map(() => '?').join(', ')})`
    ).bind(level, ...chunk).all<{ word: string; meaning: string }>();
    results.forEach((r) => meanings.set(r.word, r.meaning));
  }
  const fromDictionary = meanings.size;

  // 3. The rest from Scala, in one request.
  const askAi = need.filter((n) => !meanings.has(n.word)).slice(0, MAX_WORDS);
  let fromAi = 0;
  if (askAi.length) {
    for (const { model, attempts } of models) {
      let answered = false;
      for (let attempt = 0; attempt < attempts && !answered; attempt++) {
        try {
          const found = await askForMeanings(model, level, askAi);
          if (found.size) {
            answered = true;
            fromAi = found.size;
            found.forEach((m, w) => meanings.set(w, m));
            await db.batch([...found].map(([word, meaning]) =>
              db.prepare(`INSERT OR IGNORE INTO word_meanings (word, level, meaning, source, created_at) VALUES (?, ?, ?, 'ai', ?)`)
                .bind(word, level, meaning, now)));
          }
        } catch (e) {
          console.error(`Word meanings failed (${model.name})`, e);
        }
      }
      if (answered) break;
    }
  }

  // Put the meanings on the words in the book (only where there's none yet), and save.
  const changed = scenes.flatMap((s) => {
    let touched = false;
    const data: SceneDraft = {
      ...s.data,
      bubbles: s.data.bubbles.map((b) => ({
        ...b,
        tokens: {
          ...b.tokens,
          en: (b.tokens.en ?? []).map((t) => {
            const meaning = t.v && !t.gloss?.trim() ? meanings.get(bareWord(t.t)) : undefined;
            if (!meaning) return t;
            touched = true;
            return { ...t, gloss: meaning };
          }),
        },
      })),
    };
    return touched ? [{ id: s.id, data }] : [];
  });
  if (changed.length) await saveFinishedBook(db, userId, projectId, { cast: project.cast, quiz: null, filled: changed, added: [] });

  return {
    filled: need.filter((n) => meanings.has(n.word)).length,
    from_dictionary: fromDictionary,
    from_ai: fromAi,
    missing: need.filter((n) => !meanings.has(n.word)).map((n) => n.word),
  };
}
