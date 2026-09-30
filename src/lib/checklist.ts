// What a book must pass before it can be sent to a moderator. The Studio's Review button
// shows these one by one; the API runs them (plus Scala's spell check) and runs them
// again when the book is sent, so no phone can skip them.

import { FEATURES } from './features';
import { LEVELS, buildVocab, type Level, type QuizItem, type SceneDraft } from './format';
import { hasWordList, wordsAboveLevel } from './levels';

export interface ChecklistBook {
  id: string;
  title: string;
  description?: string;
  level: Level;
  /** Learning books also need the level, new words and quiz checks. */
  purpose?: 'learning' | 'reading';
  quiz: QuizItem[];
}

export type CheckId = 'details' | 'pages' | 'lines' | 'art' | 'spelling' | 'level' | 'words' | 'quiz';

export interface Problem {
  /** 1-based scene number, when the problem is on a page. */
  scene?: number;
  message: string;
}

export interface Check {
  id: CheckId;
  label: string;
  /** skipped: not checked (switched off, or needs Scala); doesn't block sending. */
  status: 'pass' | 'fail' | 'skipped';
  problems: Problem[];
  note?: string;
}

export const MIN_NEW_WORDS = 3;
export const QUIZ_RANGE = [3, 5] as const;

const words = (d: SceneDraft) => d.bubbles.some((b) => b.text.en.trim()) || Boolean(d.caption?.trim());
const result = (id: CheckId, label: string, problems: Problem[], extra: Partial<Check> = {}): Check =>
  ({ id, label, status: problems.length ? 'fail' : 'pass', problems, ...extra });

/** The checks that need no AI, in the order the Review animation shows them. Spelling is added by the API. */
export function bookChecks(book: ChecklistBook, drafts: SceneDraft[]): Check[] {
  const learning = book.purpose !== 'reading';
  const checks: Check[] = [];

  const details: Problem[] = [];
  if (!book.title.trim()) details.push({ message: 'Add a title on the Details tab.' });
  if (!book.description?.trim()) details.push({ message: 'Add a short description on the Details tab.' });
  checks.push(result('details', 'Title and description', details));

  const pages: Problem[] = drafts.length ? [] : [{ message: 'Add at least one page.' }];
  drafts.forEach((d, i) => { if (!words(d)) pages.push({ scene: i + 1, message: 'This page is blank: add words or delete it.' }); });
  checks.push(result('pages', 'No empty or blank pages', pages));

  const lines: Problem[] = [];
  drafts.forEach((d, i) => d.bubbles.forEach((b, j) => {
    if (!b.text.en.trim()) lines.push({ scene: i + 1, message: `Line ${j + 1} has no words.` });
    else if (b.style !== 'narration' && !b.characterId) lines.push({ scene: i + 1, message: `Line ${j + 1}: choose who says it.` });
  }));
  checks.push(result('lines', 'Every line is complete', lines));

  const art: Problem[] = [];
  if (FEATURES.rendering) {
    drafts.forEach((d, i) => { if (!d.layers.some((l) => d.assets[l.asset])) art.push({ scene: i + 1, message: 'No picture yet: make the scene’s art.' }); });
    checks.push(result('art', 'Art on every page', art));
  } else {
    checks.push({ id: 'art', label: 'Art on every page', status: 'skipped', problems: [], note: 'Illustrations are switched off for now.' });
  }

  if (!learning) return checks;

  const levelLabel = LEVELS.find((l) => l.id === book.level)?.label ?? book.level;
  const vocab = buildVocab(drafts);
  if (hasWordList(book.level)) {
    const allowed = [...drafts.flatMap((d) => d.bubbles.map((b) => b.speaker)), ...vocab.map((v) => v.headword)];
    const hard: Problem[] = [];
    drafts.forEach((d, i) => {
      const found = [d.caption ?? '', ...d.bubbles.map((b) => b.text.en)].flatMap((t) => (t.trim() ? wordsAboveLevel(t, book.level, allowed) : []));
      const unique = [...new Set(found)];
      if (unique.length) hard.push({ scene: i + 1, message: `Above ${book.level}: ${unique.join(', ')}. Use simpler words, or teach them as new words.` });
    });
    checks.push(result('level', `Words fit ${levelLabel}`, hard));
  } else {
    checks.push({ id: 'level', label: `Words fit ${levelLabel}`, status: 'skipped', problems: [], note: `There’s no word list for ${book.level} yet.` });
  }

  const newWords: Problem[] = [];
  if (vocab.length < MIN_NEW_WORDS) newWords.push({ message: `Teach at least ${MIN_NEW_WORDS} new words (there ${vocab.length === 1 ? 'is' : 'are'} ${vocab.length}). Tap a word in a line to mark it.` });
  for (const v of vocab) if (!v.meaning.trim()) newWords.push({ message: `“${v.headword}” needs a meaning.` });
  checks.push(result('words', 'New words have meanings', newWords));

  const [min, max] = QUIZ_RANGE;
  const quiz: Problem[] = book.quiz.length < min || book.quiz.length > max
    ? [{ message: `The quiz has ${book.quiz.length} question${book.quiz.length === 1 ? '' : 's'}; it needs ${min} to ${max}.` }]
    : [];
  checks.push(result('quiz', `Quiz has ${min} to ${max} questions`, quiz));
  return checks;
}

/** True when nothing blocks sending: every check passed or was skipped. */
export const allClear = (checks: Check[]) => checks.every((c) => c.status !== 'fail');
