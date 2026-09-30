// The AI layer. Each task says what it needs and gets the cheapest model that does it
// (docs/plans/pilot-build-plan.md → Weeks 3–5). For now there is one task, the short
// description on Scala’s Shelf, on Cloudflare Workers AI's free daily allowance. Other
// tasks and providers (Together, Anthropic, Azure) plug in here as credits arrive.
// AI output is always a draft: the writer can edit it and a reviewer checks every book.

import { BadRequest } from '../errors';
import type { TextModel } from '../platform';

/** Workers AI's binding: env.AI.run(model, input). */
export interface WorkersAi {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

export const WORKERS_AI_TEXT_MODEL = '@cf/meta/llama-3.1-8b-instruct';

export function workersAiText(ai: WorkersAi, model = WORKERS_AI_TEXT_MODEL): TextModel {
  return {
    name: `workers-ai/${model}`,
    async complete(system, prompt, maxTokens) {
      const out = (await ai.run(model, {
        messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.4,
      })) as { response?: string };
      return out.response ?? '';
    },
  };
}

export interface DescribeInput {
  title: string;
  level: string;
  /** The story's text in reading order: captions and speech lines, "Speaker: line". */
  lines: string[];
}

export interface Suggestion {
  description: string;
  /** "ai" when a model wrote it, "rules" when no model is set up (local dev). */
  source: 'ai' | 'rules';
}

const MAX_STORY_CHARS = 4000;
const MAX_DESCRIPTION_CHARS = 180;

function checkInput(input: DescribeInput): DescribeInput {
  if (!input || !Array.isArray(input.lines)) throw new BadRequest('Expected { title, level, lines }');
  const lines = input.lines.filter((l): l is string => typeof l === 'string' && l.trim() !== '');
  if (lines.length === 0) throw new BadRequest('Write some of the story first');
  return { title: String(input.title ?? '').slice(0, 120), level: String(input.level ?? 'A1').slice(0, 4), lines };
}

/** Cuts text to a length at a word boundary, ending with a full stop. */
function trimSentence(text: string, max: number): string {
  let s = text.replace(/\s+/g, ' ').trim();
  if (s.length > max) {
    // Cut at a space when there's one in the second half; Lao and Thai don't space words, so cut there.
    const space = s.lastIndexOf(' ', max);
    s = s.slice(0, space > max / 2 ? space : max).replace(/[,;:—-]+$/, '');
  }
  return /[.!?]$/.test(s) ? s : `${s}.`;
}

/** Tidies a model's answer: first line only, no quotes or "Description:" label. */
export function cleanDescription(raw: string): string {
  const line = raw.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  const bare = line.replace(/^(description|summary)\s*:\s*/i, '').replace(/^["“'‘]+|["”'’]+$/g, '').trim();
  return bare ? trimSentence(bare, MAX_DESCRIPTION_CHARS) : '';
}

/** One short sentence for the book's card on Scala’s Shelf. */
export async function suggestDescription(model: TextModel | undefined, raw: DescribeInput): Promise<Suggestion> {
  const input = checkInput(raw);
  const rulesVersion = { description: trimSentence(input.lines[0].replace(/^[^:]{1,30}:\s*/, ''), MAX_DESCRIPTION_CHARS), source: 'rules' as const };
  if (!model) return rulesVersion;

  const story = input.lines.join('\n').slice(0, MAX_STORY_CHARS);
  const system =
    'You write the one-sentence blurb shown on a children\'s book card in a reading app for English learners. ' +
    `Write for CEFR level ${input.level}: short, simple, everyday words, present tense. ` +
    'Say who the story is about and the problem or goal. Do not give away the ending. ' +
    'Maximum 20 words. Reply with the sentence only.';
  const prompt = `Title: ${input.title || '(untitled)'}\n\nStory:\n${story}`;
  try {
    const description = cleanDescription(await model.complete(system, prompt, 80));
    return description ? { description, source: 'ai' } : rulesVersion;
  } catch (e) {
    console.error(`AI description failed (${model.name})`, e);
    return rulesVersion;
  }
}

// ---- New book: tidy the writer's idea, and pick a level for learning books ----

export interface IdeaInput {
  title: string;
  /** The writer's own words about the story they want to write. */
  idea: string;
  purpose: 'learning' | 'reading';
}

export interface IdeaSuggestion {
  description: string;
  /** Learning books only: the CEFR level to write the story at. */
  level: 'A1' | 'A2' | 'B1' | 'B2' | null;
  source: 'ai' | 'rules';
}

const LEVEL_IDS = ['A1', 'A2', 'B1', 'B2'] as const;
const MAX_IDEA_CHARS = 2000;

/** Pulls {"description", "level"} out of a model's answer, tolerating extra text around the JSON. */
export function parseIdeaAnswer(raw: string): { description: string; level: IdeaSuggestion['level'] } {
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  let description = '';
  let level: IdeaSuggestion['level'] = null;
  if (json) {
    try {
      const parsed = JSON.parse(json) as { description?: unknown; level?: unknown };
      if (typeof parsed.description === 'string') description = cleanDescription(parsed.description);
      const l = String(parsed.level ?? '').toUpperCase();
      level = (LEVEL_IDS as readonly string[]).includes(l) ? (l as IdeaSuggestion['level']) : null;
    } catch { /* not JSON after all */ }
  }
  return { description, level };
}

export async function suggestFromIdea(model: TextModel | undefined, raw: IdeaInput): Promise<IdeaSuggestion> {
  const idea = typeof raw?.idea === 'string' ? raw.idea.trim().slice(0, MAX_IDEA_CHARS) : '';
  if (!idea) throw new BadRequest('Describe the story first');
  const purpose = raw.purpose === 'reading' ? 'reading' : 'learning';
  const title = String(raw.title ?? '').slice(0, 120);
  const rules: IdeaSuggestion = {
    description: trimSentence(idea, MAX_DESCRIPTION_CHARS),
    level: purpose === 'learning' ? 'A1' : null,
    source: 'rules',
  };
  if (!model) return rules;

  const system =
    'You help writers start a children\'s book for a free reading app used in underserved communities. ' +
    'The writer describes the story they want to write. Rewrite it as the one-sentence blurb for the book\'s card: ' +
    'clear, warm, simple words, present tense, who it is about and the problem or goal, no ending, at most 25 words. ' +
    (purpose === 'learning'
      ? 'The book teaches English. Also choose the CEFR level (A1, A2, B1 or B2) the story should be written at, ' +
        'from who the readers are and how hard the ideas are. Use A1 when unsure. '
      : 'The book is just for reading, not for teaching English, so there is no level. ') +
    'Reply with JSON only: {"description": "...", "level": "A1"}' + (purpose === 'learning' ? '' : ' with "level": null') + '.';
  const prompt = `Title: ${title || '(untitled)'}\n\nThe writer's idea:\n${idea}`;
  try {
    const answer = parseIdeaAnswer(await model.complete(system, prompt, 160));
    if (!answer.description) return rules;
    return { description: answer.description, level: purpose === 'learning' ? answer.level ?? 'A1' : null, source: 'ai' };
  } catch (e) {
    console.error(`AI idea suggestion failed (${model.name})`, e);
    return rules;
  }
}

// ---- Finish the book: AI writes the rest of the story ----

export interface FinishInput {
  title: string;
  description: string;
  purpose: 'learning' | 'reading';
  level: string;
  characters: { name: string; description: string }[];
  places: { name: string; description: string }[];
  /** The scenes the writer has already written, in order. */
  scenes: { place: string; caption: string; lines: { speaker: string; text: string }[] }[];
  /** How many scenes the whole book should have. */
  sceneCount: number;
}

export interface FinishedScene {
  place: string;
  /** What the picture shows: the illustration is made from this. */
  picture: string;
  caption: string;
  /** speaker "" means narration. */
  lines: { speaker: string; text: string }[];
}

export interface FinishResult {
  scenes: FinishedScene[];
  /** Characters and places the new scenes use that aren't in the cast yet. */
  characters: { name: string; description: string }[];
  places: { name: string; description: string }[];
  /** Learning books: words the story teaches, with simple meanings. */
  words: { word: string; meaning: string }[];
}

/** Most scenes one answer may add. */
const MAX_SCENES = 10;
const MAX_LINES = 6;
/** How much of the story so far the model sees; older scenes are dropped first. */
const MAX_SO_FAR_CHARS = 6000;
const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');
/** An array of objects, with anything that isn't an object dropped. */
const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as T[]) : []);

/** Checks and trims the model's JSON. Anything malformed is dropped rather than trusted. */
export function parseFinishAnswer(raw: string, purpose: 'learning' | 'reading'): FinishResult {
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error('No JSON in the answer');
  const data = JSON.parse(json) as Record<string, unknown>;
  const members = (v: unknown) => list<Record<string, unknown>>(v)
    .map((m) => ({ name: clip(m?.name, 40), description: clip(m?.description, 300) }))
    .filter((m) => m.name);
  const scenes = list<Record<string, unknown>>(data.scenes).slice(0, MAX_SCENES).map((s) => ({
    place: clip(s?.place, 40),
    picture: clip(s?.picture, 400),
    caption: clip(s?.caption, 200),
    lines: list<Record<string, unknown>>(s?.lines).slice(0, MAX_LINES)
      .map((l) => {
        const speaker = clip(l?.speaker, 40);
        return { speaker: /^(narrator|narration|none|null)$/i.test(speaker) ? '' : speaker, text: clip(l?.text, 200) };
      })
      .filter((l) => l.text),
  })).filter((s) => s.lines.length || s.caption);
  if (!scenes.length) throw new Error('No usable scenes in the answer');
  const words = purpose === 'learning'
    ? list<Record<string, unknown>>(data.words).map((w) => ({ word: clip(w?.word, 30), meaning: clip(w?.meaning, 120) }))
      .filter((w) => w.word && w.meaning).slice(0, 8)
    : [];
  return { scenes, characters: members(data.characters), places: members(data.places), words };
}

export async function finishStory(model: TextModel | undefined, raw: FinishInput): Promise<FinishResult> {
  if (!model) throw new BadRequest('AI isn’t set up here. It works on the live site.');
  if (!raw || typeof raw !== 'object') throw new BadRequest('Expected the book so far');
  const purpose = raw.purpose === 'reading' ? 'reading' : 'learning';
  const level = String(raw.level ?? 'A1').slice(0, 4);
  const written = list<FinishInput['scenes'][number]>(raw.scenes);
  // Always at least one more scene (the ending), and never more than one answer can hold.
  const toWrite = Math.min(MAX_SCENES, Math.max(1, (Number(raw.sceneCount) || 6) - written.length));

  const cast = [
    ...list<{ name: string; description: string }>(raw.characters).map((c) => `- character: ${clip(c.name, 40)}: ${clip(c.description, 200)}`),
    ...list<{ name: string; description: string }>(raw.places).map((p) => `- place: ${clip(p.name, 40)}: ${clip(p.description, 200)}`),
  ].join('\n');
  const sceneText = written.map((s, i) => [
    `Scene ${i + 1} (${clip(s.place, 40) || 'no place yet'})`,
    ...(s.caption ? [`  Text on screen: ${clip(s.caption, 200)}`] : []),
    ...list<{ speaker: string; text: string }>(s.lines).map((l) => `  ${clip(l.speaker, 40) || 'Narrator'}: ${clip(l.text, 200)}`),
  ].join('\n'));
  // Keep the most recent scenes when the story is long: the model continues from the end.
  let soFar = sceneText.join('\n');
  for (let from = 1; soFar.length > MAX_SO_FAR_CHARS && from < sceneText.length; from++) {
    soFar = `(earlier scenes left out)\n${sceneText.slice(from).join('\n')}`;
  }

  const system =
    'You write short illustrated children\'s comics for a free reading app used in underserved communities. ' +
    (purpose === 'learning'
      ? `The book teaches English at CEFR level ${level}: short sentences, simple everyday words, and a few new words that the story explains through context. `
      : 'The book is for reading and enjoyment: warm, simple, natural English. ') +
    `Continue the story with exactly ${toWrite} more scene${toWrite === 1 ? '' : 's'} and give it a satisfying ending. ` +
    'Each scene has 1 to 4 lines. A line is spoken by a character, or is narration (speaker ""). ' +
    'Reuse the existing characters and places by their exact names; add new ones only if the story needs them, with a short description of how they look. ' +
    'Keep it kind and safe for children. ' +
    'Reply with JSON only, in this shape: ' +
    '{"scenes":[{"place":"name","picture":"what the picture shows","caption":"","lines":[{"speaker":"name or empty for narration","text":"..."}]}],' +
    '"characters":[{"name":"","description":""}],"places":[{"name":"","description":""}]' +
    (purpose === 'learning' ? ',"words":[{"word":"new word used in your scenes","meaning":"simple meaning"}]' : '') + '}';
  const prompt =
    `Title: ${clip(raw.title, 120) || '(untitled)'}\n` +
    `About: ${clip(raw.description, 400) || '(no description)'}\n\n` +
    `Cast:\n${cast || '(none yet)'}\n\n` +
    `The story so far:\n${soFar || '(nothing written yet: write the whole story)'}`;

  let lastError: unknown;
  // Small models sometimes return broken JSON; one retry is usually enough.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return parseFinishAnswer(await model.complete(system, prompt, 2000), purpose);
    } catch (e) {
      lastError = e;
    }
  }
  console.error(`AI finish failed (${model.name})`, lastError);
  throw new BadRequest('AI couldn’t finish the story this time. Try again.');
}
