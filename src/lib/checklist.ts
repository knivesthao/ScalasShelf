// The checks a book must pass before it's sent for review. Shared: the Studio shows them
// as you write, and the API runs the same checks when the book is sent, so a phone
// can't send a book that skips them.

import { FEATURES } from './features';
import { buildVocab, publishChecklist, type Issue, type Level, type QuizItem, type SceneDraft } from './format';
import { wordsAboveLevel } from './levels';

export interface ChecklistBook {
  id: string;
  title: string;
  level: Level;
  /** Reading books have no level or quiz, so those checks are skipped. */
  purpose?: 'learning' | 'reading';
  quiz: QuizItem[];
}

export function bookChecklist(book: ChecklistBook, drafts: SceneDraft[]): Issue[] {
  const learning = book.purpose !== 'reading';
  // Speaker names and the words the book teaches count as known words for the level check.
  const allowed = [...drafts.flatMap((d) => d.bubbles.map((b) => b.speaker)), ...buildVocab(drafts).map((v) => v.headword)];
  return publishChecklist(
    { id: book.id, title: book.title, level: book.level },
    drafts,
    book.quiz,
    (text) => (learning ? wordsAboveLevel(text, book.level, allowed) : []),
    { art: FEATURES.rendering, audio: FEATURES.rendering },
  ).filter((i) => learning || !i.message.startsWith('Quiz has'));
}
