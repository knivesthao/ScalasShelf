// Textweaver motion-comic format (manifest v2).
//
// One module shared by the Studio (authoring), the reader and the cloud packager's
// contract. See docs/plans/MVP.md → "The comic format" and "Two editions".
//
// English only for now. Line text, words and audio are still keyed by language
// (`text.en`, `tokens.en`, `audio.en`) so localization later is additive: add a
// language to `Lang`, not a new format.
//
// Studio drafts are richer than what gets published; buildPackage() strips
// authoring-only fields and splits the episode into shared learning content
// (text.json) and per-edition visuals (chunks).

export type Lang = 'en';
export const LANGS: Lang[] = ['en'];

export type Level = 'A1' | 'A2' | 'B1' | 'B2';
export const LEVELS: { id: Level; label: string }[] = [
  { id: 'A1', label: 'A1 · Beginner' },
  { id: 'A2', label: 'A2 · Elementary' },
  { id: 'B1', label: 'B1 · Intermediate' },
  { id: 'B2', label: 'B2 · Upper intermediate' },
];

export const FORMAT_ID = 'textweaver.motion-comic/2';

/** Map a CEFR level onto the library's existing beginner/intermediate/advanced filter. */
export function readingLevel(level: Level): 'beginner' | 'intermediate' | 'advanced' {
  if (level === 'A1' || level === 'A2') return 'beginner';
  return level === 'B1' ? 'intermediate' : 'advanced';
}

// ---- Scene content ----

export type MotionPreset = 'none' | 'kenburns' | 'parallax' | 'idle' | 'pop' | 'shake';

export const MOTION_PRESETS: { id: MotionPreset; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'kenburns', label: 'Slow zoom' },
  { id: 'parallax', label: 'Parallax drift' },
  { id: 'idle', label: 'Idle (breathing)' },
  { id: 'pop', label: 'Pop in' },
  { id: 'shake', label: 'Shake' },
];

export interface Motion {
  preset: MotionPreset;
  delay?: number;
}

export interface AssetRef {
  url: string;
  bytes?: number;
  width?: number;
  height?: number;
}

export type LayerRole = 'background' | 'character' | 'prop';

/** Positions are fractions of the panel: x/y = top-left corner, w = width. */
export interface Layer {
  id: string;
  asset: string;
  role: LayerRole;
  x: number;
  y: number;
  w: number;
  z: number;
  motion?: Motion;
  /** Authoring only: what the image model was asked for (used by re-roll). */
  prompt?: string;
}

export interface Token {
  /** Exact text, including trailing spaces/punctuation. Concatenated tokens == the line. */
  t: string;
  /** Simple-English meaning, shown when the learner taps the word. */
  gloss?: string;
  /** Vocab id when this word is one of the episode's taught words. */
  v?: string;
}

export type BubbleStyle = 'speech' | 'thought' | 'narration';

export interface Bubble {
  id: string;
  /** The character's name as readers see it (kept in step with the cast). */
  speaker: string;
  /** Which cast character says this line (none for narration). */
  characterId?: string;
  style: BubbleStyle;
  x: number;
  y: number;
  w: number;
  motion?: Motion;
  text: Record<Lang, string>;
  tokens: Partial<Record<Lang, Token[]>>;
  /** Studio: storage path or object URL of the recording. Published: packaged audio path. */
  audio: Partial<Record<Lang, string>>;
}

export type Aspect = '9:16' | '4:5' | '1:1';

export interface SceneDraft {
  /** What the scene looks like: the illustration is made from this. */
  description: string;
  /** Words printed on the screen that nobody in the scene says (narration, a sign, a title). */
  caption?: string;
  /** The cast place this scene happens in; its picture becomes the background. */
  placeId?: string;
  aspect: Aspect;
  layers: Layer[];
  bubbles: Bubble[];
  assets: Record<string, AssetRef>;
}

export function emptyScene(description = ''): SceneDraft {
  return { description, caption: '', aspect: '9:16', layers: [], bubbles: [], assets: {} };
}

export function newId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

export function newBubble(index: number, speaker = ''): Bubble {
  return {
    id: newId('b'),
    speaker,
    style: 'speech',
    x: index % 2 === 0 ? 0.05 : 0.4,
    y: 0.04 + (index % 4) * 0.13,
    w: 0.55,
    motion: { preset: 'pop', delay: 300 + index * 500 },
    text: { en: '' },
    tokens: {},
    audio: {},
  };
}

// ---- Cast: the episode's characters and places ----

/** A character or place, drawn once and reused in every scene so it looks the same throughout. */
export interface CastMember {
  id: string;
  name: string;
  /** What they (or it) look like: the picture is made from this. */
  description: string;
  asset?: AssetRef;
}

export interface Cast {
  characters: CastMember[];
  places: CastMember[];
}

export const emptyCast = (): Cast => ({ characters: [], places: [] });

// ---- Learning content ----

export interface VocabEntry {
  id: string;
  headword: string;
  meaning: string;
  example?: string;
}

export interface QuizItem {
  id: string;
  /** meaning: "What does X mean?"  fill-blank: a line with the word replaced by "____". */
  type: 'meaning' | 'fill-blank';
  prompt: string;
  options: string[];
  answer: number;
}

// ---- Tokens ----

let segmenter: Intl.Segmenter | null | undefined;

function wordSegmenter(): Intl.Segmenter | null {
  if (segmenter === undefined) {
    const Seg = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
    segmenter = Seg ? new Seg('en', { granularity: 'word' }) : null;
  }
  return segmenter;
}

/**
 * Split a line into tappable words. Spaces and punctuation stick to the preceding
 * word, so joining every token's `t` reproduces the line exactly.
 */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const seg = wordSegmenter();
  const parts = seg
    ? [...seg.segment(text)].map((s) => ({ text: s.segment, word: !!s.isWordLike }))
    : text.split(/(\s+)/).filter(Boolean).map((p) => ({ text: p, word: /\S/.test(p) }));

  for (const part of parts) {
    if (part.word || tokens.length === 0) tokens.push({ t: part.text });
    else tokens[tokens.length - 1].t += part.text;
  }
  return tokens;
}

/** The word itself, lowercased, without surrounding spaces/punctuation. */
export function bareWord(t: string): string {
  return t.replace(/^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu, '').toLowerCase();
}

export function tokensMatch(tokens: Token[] | undefined, text: string): boolean {
  return !!tokens && tokens.map((tk) => tk.t).join('') === text;
}

/** Re-split a changed line, keeping meanings/vocab marks for words that survived. */
export function retokenize(text: string, previous: Token[] = []): Token[] {
  const known = new Map<string, Token>();
  for (const tk of previous) {
    if (tk.gloss || tk.v) known.set(bareWord(tk.t), tk);
  }
  return tokenize(text).map((tk) => {
    const old = known.get(bareWord(tk.t));
    return old ? { ...tk, gloss: old.gloss, v: old.v } : tk;
  });
}

/** Join a word with the next one, e.g. "ice" + "cream" → "ice cream". */
export function mergeTokens(tokens: Token[], index: number): Token[] {
  if (index < 0 || index >= tokens.length - 1) return tokens;
  const a = tokens[index];
  const b = tokens[index + 1];
  return [...tokens.slice(0, index), { t: a.t + b.t, gloss: a.gloss ?? b.gloss }, ...tokens.slice(index + 2)];
}

/** Undo a merge: split a token back into its words. */
export function splitToken(tokens: Token[], index: number): Token[] {
  const tk = tokens[index];
  if (!tk) return tokens;
  const parts = tokenize(tk.t);
  return parts.length > 1 ? [...tokens.slice(0, index), ...parts, ...tokens.slice(index + 1)] : tokens;
}

export function vocabId(headword: string): string {
  return headword.trim().toLowerCase().replace(/\s+/g, '_');
}

// ---- Episode-level builders ----

export interface EpisodeSettings {
  id: string;
  title: string;
  level: Level;
}

/** Every word marked as vocab, first occurrence wins. */
export function buildVocab(scenes: SceneDraft[]): VocabEntry[] {
  const seen = new Map<string, VocabEntry>();
  for (const scene of scenes) {
    for (const bubble of scene.bubbles) {
      for (const tk of bubble.tokens.en ?? []) {
        if (!tk.v || seen.has(tk.v)) continue;
        seen.set(tk.v, {
          id: tk.v,
          headword: bareWord(tk.t),
          meaning: tk.gloss ?? '',
          example: bubble.text.en,
        });
      }
    }
  }
  return [...seen.values()];
}

function withAnswerAt(correct: string, distractors: string[], position: number) {
  const options = [...distractors];
  const answer = Math.min(position, options.length);
  options.splice(answer, 0, correct);
  return { options, answer };
}

/**
 * Draft up to 5 questions from the episode's vocab: "what does X mean?" for the first
 * words, then fill-the-blank using the lines they appear in. Deterministic, so the
 * writer sees the same draft every time and edits from there.
 */
export function draftQuiz(vocab: VocabEntry[]): QuizItem[] {
  const usable = vocab.filter((v) => v.headword && v.meaning);
  if (usable.length < 2) return [];
  const others = (id: string) => usable.filter((v) => v.id !== id).slice(0, 3);
  const items: QuizItem[] = [];

  usable.slice(0, 3).forEach((entry, i) => {
    const distractors = others(entry.id).map((v) => v.meaning);
    items.push({
      id: `q_meaning_${entry.id}`,
      type: 'meaning',
      prompt: entry.headword,
      ...withAnswerAt(entry.meaning, distractors, i % (distractors.length + 1)),
    });
  });

  usable
    .map((entry) => ({ entry, match: entry.example?.match(new RegExp(`\\b${escapeRegExp(entry.headword)}\\b`, 'i')) }))
    .filter(({ match }) => match)
    .slice(0, 2)
    .forEach(({ entry, match }, i) => {
      const distractors = others(entry.id).map((v) => v.headword);
      items.push({
        id: `q_blank_${entry.id}`,
        type: 'fill-blank',
        prompt: entry.example!.replace(match![0], '____'),
        ...withAnswerAt(entry.headword, distractors, (i + 1) % (distractors.length + 1)),
      });
    });

  return items.slice(0, 5);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---- Publish checklist ----

export interface Issue {
  level: 'error' | 'warning';
  message: string;
  scene?: number;
}

export function publishChecklist(
  settings: EpisodeSettings,
  scenes: SceneDraft[],
  quiz: QuizItem[],
  aboveLevel: (text: string) => string[] = () => [],
  /** Turn off checks for features that are switched off (see FEATURES). */
  check: { art?: boolean; audio?: boolean } = {}
): Issue[] {
  const { art = true, audio = true } = check;
  const issues: Issue[] = [];

  if (!settings.title.trim()) issues.push({ level: 'error', message: 'Add a title.' });
  if (scenes.length === 0) issues.push({ level: 'error', message: 'Add at least one scene.' });

  scenes.forEach((scene, i) => {
    const n = i + 1;
    if (art && !scene.layers.some((l) => scene.assets[l.asset])) {
      issues.push({ level: 'error', scene: n, message: 'No art yet: generate the scene.' });
    }
    const caption = scene.caption?.trim() ?? '';
    if (scene.bubbles.length === 0 && !caption) {
      issues.push({ level: 'warning', scene: n, message: 'No dialogue or narration.' });
    }
    const hardInCaption = caption ? aboveLevel(caption) : [];
    if (hardInCaption.length) {
      issues.push({ level: 'warning', scene: n, message: `Text on screen has words above ${settings.level}: ${hardInCaption.join(', ')}` });
    }
    scene.bubbles.forEach((b, j) => {
      const line = `Line ${j + 1}`;
      if (!b.text.en.trim()) {
        issues.push({ level: 'error', scene: n, message: `${line} is empty.` });
        return;
      }
      if (audio && !b.audio.en) issues.push({ level: 'warning', scene: n, message: `${line} has no audio.` });
      const hard = aboveLevel(b.text.en);
      if (hard.length) {
        issues.push({ level: 'warning', scene: n, message: `${line} has words above ${settings.level}: ${hard.join(', ')}` });
      }
    });
  });

  if (quiz.length < 3) {
    issues.push({ level: 'warning', message: `Quiz has ${quiz.length} questions (aim for 3–5).` });
  }
  return issues;
}

// ---- Package (manifest v2) ----

export interface PublishedLayer {
  asset: string;
  role: LayerRole;
  x: number;
  y: number;
  w: number;
  z: number;
  motion?: Motion;
}

export interface PublishedBubble {
  id: string;
  speaker: string;
  style: BubbleStyle;
  x: number;
  y: number;
  w: number;
  motion?: Motion;
}

export interface PublishedScene {
  n: number;
  aspect: Aspect;
  layers: PublishedLayer[];
  /** Placement only; the words live in text.json so every edition shares them. */
  bubbles: PublishedBubble[];
}

export interface EpisodeText {
  bubbles: Record<string, Pick<Bubble, 'text' | 'tokens' | 'audio'>>;
  /** Scene number → the words printed on screen for that scene (SceneDraft.caption). */
  captions?: Record<string, Record<Lang, string>>;
  vocab: VocabEntry[];
  quiz: QuizItem[];
}

export interface EditionManifest {
  renderer: 'lite' | 'ue5' | 'unity';
  assets: Record<string, AssetRef>;
  chunks: { n: number; url: string; scenes: number[]; assets: string[] }[];
}

export interface Manifest {
  format: typeof FORMAT_ID;
  id: string;
  title: string;
  level: Level;
  languages: Lang[];
  text: { url: string };
  editions: { lite: EditionManifest; hd?: EditionManifest };
}

export interface Package {
  manifest: Manifest;
  text: EpisodeText;
  /** chunk url → scenes in that chunk */
  chunks: Record<string, { scenes: PublishedScene[] }>;
}

export const SCENES_PER_CHUNK = 4;

export function buildPackage(settings: EpisodeSettings, scenes: SceneDraft[], quiz: QuizItem[]): Package {
  const text: EpisodeText = { bubbles: {}, vocab: buildVocab(scenes), quiz };
  const assets: Record<string, AssetRef> = {};

  const published: PublishedScene[] = scenes.map((scene, i) => {
    for (const layer of scene.layers) {
      const ref = scene.assets[layer.asset];
      if (ref) assets[layer.asset] = ref;
    }
    for (const b of scene.bubbles) {
      const tokens = tokensMatch(b.tokens.en, b.text.en) ? b.tokens : { en: tokenize(b.text.en) };
      text.bubbles[b.id] = { text: b.text, tokens, audio: b.audio };
    }
    if (scene.caption?.trim()) (text.captions ??= {})[String(i + 1)] = { en: scene.caption.trim() };
    return {
      n: i + 1,
      aspect: scene.aspect,
      layers: scene.layers
        .filter((l) => scene.assets[l.asset])
        .map(({ asset, role, x, y, w, z, motion }) => ({ asset, role, x, y, w, z, motion })),
      bubbles: scene.bubbles.map(({ id, speaker, style, x, y, w, motion }) => ({ id, speaker, style, x, y, w, motion })),
    };
  });

  const chunks: Package['chunks'] = {};
  const chunkList: EditionManifest['chunks'] = [];
  for (let start = 0; start < published.length; start += SCENES_PER_CHUNK) {
    const group = published.slice(start, start + SCENES_PER_CHUNK);
    const n = chunkList.length + 1;
    const url = `lite/chunks/${String(n).padStart(2, '0')}.json`;
    chunks[url] = { scenes: group };
    chunkList.push({
      n,
      url,
      scenes: group.map((s) => s.n),
      assets: [...new Set(group.flatMap((s) => s.layers.map((l) => l.asset)))],
    });
  }

  return {
    manifest: {
      format: FORMAT_ID,
      id: settings.id,
      title: settings.title,
      level: settings.level,
      languages: LANGS,
      text: { url: 'text.json' },
      editions: { lite: { renderer: 'lite', assets, chunks: chunkList } },
    },
    text,
    chunks,
  };
}

/** Structural checks on a package; returns human-readable problems (empty = valid). */
export function validatePackage(pkg: Package): string[] {
  const problems: string[] = [];
  const { manifest, text } = pkg;
  if (manifest.format !== FORMAT_ID) problems.push(`Unknown format ${manifest.format}`);
  const lite = manifest.editions.lite;

  for (const chunk of lite.chunks) {
    const file = pkg.chunks[chunk.url];
    if (!file) {
      problems.push(`Chunk ${chunk.url} is listed but missing`);
      continue;
    }
    for (const scene of file.scenes) {
      for (const layer of scene.layers) {
        if (!lite.assets[layer.asset]) problems.push(`Scene ${scene.n}: image ${layer.asset} is missing`);
      }
      for (const b of scene.bubbles) {
        const t = text.bubbles[b.id];
        if (!t) problems.push(`Scene ${scene.n}: bubble ${b.id} has no text`);
        else if (!tokensMatch(t.tokens.en, t.text.en)) problems.push(`Scene ${scene.n}: words don't match the line`);
      }
    }
  }
  return problems;
}
