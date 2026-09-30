// Spell check through LanguageTool's public API (https://languagetool.org/http-api/),
// not AI: it's free, needs no key, and is built for exactly this. Only spelling
// mistakes (the TYPOS category) are asked for. The book's text is sent to
// LanguageTool's servers; it's story text, never anything about readers.

import type { Cast, SceneDraft } from '../../../src/lib/format';
import type { Check, Problem } from '../../../src/lib/checklist';

export interface SpellingMistake {
  offset: number;
  length: number;
  suggestions: string[];
}

export interface SpellChecker {
  check(text: string, language: string): Promise<SpellingMistake[]>;
}

const LANGUAGETOOL_URL = 'https://api.languagetool.org/v2/check';

export function languageTool(url = LANGUAGETOOL_URL): SpellChecker {
  return {
    async check(text, language) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: new URLSearchParams({ text, language, enabledOnly: 'true', enabledCategories: 'TYPOS' }),
      });
      if (!res.ok) throw new Error(`LanguageTool answered ${res.status}`);
      const data = (await res.json()) as { matches?: { offset: number; length: number; replacements?: { value: string }[] }[] };
      return (data.matches ?? []).map((m) => ({
        offset: m.offset,
        length: m.length,
        suggestions: (m.replacements ?? []).slice(0, 3).map((r) => r.value),
      }));
    },
  };
}

/** Runs the spell check over every caption and line, and says which page each mistake is on. */
export async function spellingCheck(checker: SpellChecker | undefined, drafts: SceneDraft[], cast: Cast): Promise<Check> {
  const base = { id: 'spelling' as const, label: 'Spelling' };
  if (!checker) return { ...base, status: 'skipped', problems: [], note: 'The spell checker isn’t set up here.' };

  // One request for the whole book; remember where each piece of text starts.
  const pieces: { scene: number; start: number; text: string }[] = [];
  let text = '';
  drafts.forEach((d, i) => {
    for (const t of [d.caption ?? '', ...d.bubbles.map((b) => b.text.en)]) {
      if (!t.trim()) continue;
      pieces.push({ scene: i + 1, start: text.length, text: t });
      text += `${t}\n\n`;
    }
  });
  if (!text.trim()) return { ...base, status: 'pass', problems: [] };

  let mistakes: SpellingMistake[];
  try {
    mistakes = await checker.check(text, 'en-US');
  } catch (e) {
    console.error('Spell check failed', e);
    return { ...base, status: 'skipped', problems: [], note: 'Couldn’t reach the spell checker. Review again in a moment.' };
  }

  // Names in the cast (and speakers) aren't mistakes, even if the dictionary doesn't know them.
  const names = new Set([
    ...cast.characters, ...cast.places,
  ].flatMap((m) => m.name.toLowerCase().split(/\s+/)).concat(drafts.flatMap((d) => d.bubbles.map((b) => b.speaker.toLowerCase()))));
  const problems: Problem[] = [];
  const seen = new Set<string>();
  for (const m of mistakes) {
    const piece = pieces.find((p) => m.offset >= p.start && m.offset < p.start + p.text.length);
    if (!piece) continue;
    const word = text.slice(m.offset, m.offset + m.length);
    const key = `${piece.scene}:${word.toLowerCase()}`;
    if (names.has(word.toLowerCase()) || seen.has(key)) continue;
    seen.add(key);
    problems.push({
      scene: piece.scene,
      message: m.suggestions.length ? `“${word}”: did you mean ${m.suggestions.map((s) => `“${s}”`).join(' or ')}?` : `“${word}” may be misspelled.`,
    });
  }
  return { ...base, status: problems.length ? 'fail' : 'pass', problems };
}
