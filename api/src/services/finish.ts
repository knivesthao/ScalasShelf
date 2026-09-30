// Scala Finish on the server: loads the book, asks Scala (services/ai.ts → finishStory) to
// write the rest, turns the answer into scenes, cast and quiz, and saves it all. The phone
// only asks for it and reloads the book. Scenes the writer already wrote are kept; empty
// scenes after the last written one are filled first, then new scenes are added. For
// learning books the new words are marked in the lines and a quiz is drafted from them.

import {
  buildVocab, draftQuiz, emptyScene, newBubble, newId, retokenize, vocabId,
  type Cast, type CastMember, type QuizItem, type SceneDraft,
} from '../../../src/lib/format';
import type { Db, TextModel } from '../platform';
import { finishStory, type FinishResult } from './ai';
import { getProject, saveFinishedBook } from './studio';

/** A scene counts as written once it has any words in it. */
export const sceneWritten = (d: SceneDraft) => d.bubbles.some((b) => b.text.en.trim()) || Boolean(d.caption?.trim());

/** Scenes the whole book should have when the writer hasn't written many yet. */
const DEFAULT_SCENES = 6;

/** Finds a cast member by name, or adds one. Returns the updated list and the member. */
function findOrAdd(list: CastMember[], name: string, description: string, prefix: 'char' | 'place') {
  const found = list.find((m) => m.name.toLowerCase() === name.toLowerCase());
  if (found) return { list, member: found };
  const member: CastMember = { id: newId(prefix), name, description };
  return { list: [...list, member], member };
}

export interface FinishedBook {
  cast: Cast;
  /** New drafts for the empty scenes, by index into the drafts passed in. */
  filled: Map<number, SceneDraft>;
  /** Scenes to add after the existing ones. */
  added: SceneDraft[];
  /** A drafted quiz, when it's a learning book without one yet. */
  quiz: QuizItem[] | null;
}

export function applyFinish(
  result: FinishResult,
  book: { purpose: 'learning' | 'reading'; cast: Cast; quiz: QuizItem[] },
  drafts: SceneDraft[],
): FinishedBook {
  let { characters, places } = book.cast;
  const describe = (list: FinishResult['characters'], name: string) =>
    list.find((m) => m.name.toLowerCase() === name.toLowerCase())?.description ?? '';

  // Each taught word is marked once, where it first appears.
  const words = new Map(result.words.map((w) => [w.word.toLowerCase(), w]));
  const marked = new Set<string>();

  const scenes = result.scenes.map((s) => {
    let placeId: string | undefined;
    if (s.place) {
      const r = findOrAdd(places, s.place, describe(result.places, s.place) || s.picture, 'place');
      places = r.list;
      placeId = r.member.id;
    }
    const bubbles = s.lines.map((line, i) => {
      const tokens = retokenize(line.text).map((tk) => {
        const key = tk.t.trim().toLowerCase().replace(/[^\p{L}\p{N}'’-]/gu, '');
        const w = words.get(key);
        if (!w || marked.has(key)) return tk;
        marked.add(key);
        return { ...tk, v: vocabId(w.word), gloss: w.meaning };
      });
      if (!line.speaker) {
        return { ...newBubble(i), style: 'narration' as const, speaker: '', text: { en: line.text }, tokens: { en: tokens } };
      }
      const r = findOrAdd(characters, line.speaker, describe(result.characters, line.speaker), 'char');
      characters = r.list;
      return { ...newBubble(i, r.member.name), characterId: r.member.id, text: { en: line.text }, tokens: { en: tokens } };
    });
    const draft: SceneDraft = {
      description: s.picture || s.place,
      caption: s.caption,
      placeId,
      aspect: '9:16',
      layers: [],
      bubbles,
      assets: {},
    };
    return draft;
  });

  const filled = new Map<number, SceneDraft>();
  const lastWritten = drafts.reduce((last, d, i) => (sceneWritten(d) ? i : last), -1);
  const empty = drafts.map((d, i) => (i > lastWritten && !sceneWritten(d) ? i : -1)).filter((i) => i >= 0);
  empty.forEach((index, n) => { if (scenes[n]) filled.set(index, scenes[n]); });
  const added = scenes.slice(empty.length);

  const all = drafts.map((d, i) => filled.get(i) ?? d).concat(added);
  const quiz = book.purpose === 'learning' && book.quiz.length === 0 ? draftQuiz(buildVocab(all)) : null;
  return { cast: { characters, places }, filled, added, quiz: quiz && quiz.length ? quiz : null };
}


/** Runs Scala Finish for a project and saves the result. Returns the updated book. */
export async function finishProject(db: Db, model: TextModel | undefined, userId: string, projectId: string) {
  const { project, scenes } = await getProject(db, userId, projectId);
  const drafts = scenes.map((s) => ({ ...emptyScene(), ...s.data }));
  const written = drafts.filter(sceneWritten);
  const name = (list: CastMember[], id?: string) => list.find((m) => m.id === id)?.name ?? '';
  const result = await finishStory(model, {
    project_id: project.id,
    title: project.title,
    description: project.description,
    purpose: project.purpose,
    level: project.level,
    characters: project.cast.characters.map(({ name: n, description }) => ({ name: n, description })),
    places: project.cast.places.map(({ name: n, description }) => ({ name: n, description })),
    scenes: written.map((d) => ({
      place: name(project.cast.places, d.placeId),
      caption: d.caption ?? '',
      lines: d.bubbles.filter((b) => b.text.en.trim()).map((b) => ({ speaker: b.style === 'narration' ? '' : b.speaker, text: b.text.en })),
    })),
    sceneCount: Math.max(DEFAULT_SCENES, written.length + 2),
  });
  const done = applyFinish(result, project, drafts);
  await saveFinishedBook(db, userId, projectId, {
    cast: done.cast,
    quiz: done.quiz,
    filled: [...done.filled].map(([index, data]) => ({ id: scenes[index].id, data })),
    added: done.added,
  });
  const firstFilled = Math.min(...done.filled.keys());
  return { ...(await getProject(db, userId, projectId)), first_new_scene: Number.isFinite(firstFilled) ? firstFilled : scenes.length };
}
