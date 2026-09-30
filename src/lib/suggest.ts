// Suggestions for the Publish tab. The level comes from the word lists (no AI needed);
// the short description is written by AI on the server (api/src/services/ai.ts).

import { api } from './api';
import type { Level, SceneDraft } from './format';
import { hasWordList, wordsAboveLevel } from './levels';

/** The story's text in reading order: captions, then each line as "Speaker: line". */
export function storyLines(drafts: SceneDraft[]): string[] {
  return drafts.flatMap((d) => [
    ...(d.caption?.trim() ? [d.caption.trim()] : []),
    ...d.bubbles
      .filter((b) => b.text.en?.trim())
      .map((b) => (b.speaker ? `${b.speaker}: ${b.text.en.trim()}` : b.text.en.trim())),
  ]);
}

const ORDER: Level[] = ['A1', 'A2', 'B1', 'B2'];

/**
 * The lowest level whose word list covers every word in the story. Past the last list
 * (A2 for now) it suggests the next level up, since B1/B2 have no list to check against.
 * Null when there's no text yet.
 */
export function suggestLevel(drafts: SceneDraft[], allowed: string[]): Level | null {
  const text = storyLines(drafts).map((l) => l.replace(/^[^:]{1,30}:\s*/, '')).join(' ');
  if (!text.trim()) return null;
  const checked = ORDER.filter(hasWordList);
  for (const level of checked) if (wordsAboveLevel(text, level, allowed).length === 0) return level;
  return ORDER[ORDER.indexOf(checked[checked.length - 1]) + 1] ?? 'B2';
}

export function suggestDescription(projectId: string, title: string, level: Level, drafts: SceneDraft[]) {
  return api.post<{ description: string; source: 'ai' | 'rules' }>('/studio/suggest/description', {
    project_id: projectId,
    title,
    level,
    lines: storyLines(drafts),
  });
}

export interface IdeaSuggestion {
  description: string;
  level: Level | null;
  source: 'ai' | 'rules';
}

/** New book: AI tidies the writer's idea into the card description, and picks a level for learning books. */
export function suggestFromIdea(title: string, idea: string, purpose: 'learning' | 'reading') {
  return api.post<IdeaSuggestion>('/studio/suggest/idea', { title, idea, purpose });
}
