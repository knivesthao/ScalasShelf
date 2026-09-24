// Demo content: the two published demo books, and the draft the Studio starts with.
// Shared by the API seed (api/src/seed.ts, scripts that load the Cloudflare database)
// and the on-device Studio. Art comes from the demo art pack when given.

import { bareWord, mergeTokens, tokenize, type Bubble, type Level, type SceneDraft, type Token } from './format';
import { stubSceneArt, type DemoPack } from './stubArt';

export interface DemoBook {
  id: string;
  title: string;
  description: string;
  level: Level;
  created_at: string;
  scenes: SceneDraft[];
}

/** Simple meanings for words in the demo books; `vocab` words are taught (word list + quiz). */
const MEANINGS: Record<string, { gloss: string; vocab?: boolean }> = {
  market: { gloss: 'a place where people buy and sell food', vocab: true },
  mango: { gloss: 'a sweet yellow fruit', vocab: true },
  mangoes: { gloss: 'more than one mango' },
  sweet: { gloss: 'tastes like sugar', vocab: true },
  please: { gloss: 'a polite word when you ask for something', vocab: true },
  'thank you': { gloss: 'what you say when someone gives you something', vocab: true },
  early: { gloss: 'at the start of the day' },
  morning: { gloss: 'the early part of the day', vocab: true },
  buffalo: { gloss: 'a big farm animal with horns', vocab: true },
  late: { gloss: 'not on time', vocab: true },
  hungry: { gloss: 'wanting to eat', vocab: true },
  grass: { gloss: 'short green plants that animals eat', vocab: true },
  sorry: { gloss: 'what you say when you did something wrong', vocab: true },
  teacher: { gloss: 'a person who helps you learn at school' },
  school: { gloss: 'a place where children learn' },
};

function annotate(text: string): Token[] {
  let tokens = tokenize(text);
  const thank = tokens.findIndex((t) => bareWord(t.t) === 'thank');
  if (thank >= 0 && bareWord(tokens[thank + 1]?.t ?? '') === 'you') tokens = mergeTokens(tokens, thank);
  const taught = new Set<string>();
  return tokens.map((t) => {
    const word = bareWord(t.t);
    const m = MEANINGS[word];
    if (!m) return t;
    // Only the first time a taught word appears in a line gets the vocab mark.
    const v = m.vocab && !taught.has(word) ? word.replace(/\s+/g, '_') : undefined;
    if (v) taught.add(word);
    return { ...t, gloss: m.gloss, v };
  });
}

function line(id: string, speaker: string, style: Bubble['style'], text: string, x: number, y: number, w: number, delay: number, words: boolean): Bubble {
  return {
    id, speaker, style, x, y, w,
    motion: { preset: 'pop', delay },
    text: { en: text },
    tokens: words ? { en: annotate(text) } : {},
    audio: {},
  };
}

/** `pack === false` means no art (a draft); otherwise art from the pack, or plain shapes. */
function scene(description: string, bubbles: Bubble[], pack: DemoPack | null | false): SceneDraft {
  const draft: SceneDraft = { description, aspect: '9:16', layers: [], assets: {}, bubbles };
  if (pack === false) return draft;
  const characters = [...new Set(bubbles.filter((b) => b.style !== 'narration').map((b) => b.speaker))];
  return { ...draft, ...stubSceneArt({ description, characters }, pack) };
}

function noyScenes(pack: DemoPack | null | false, words: boolean): SceneDraft[] {
  return [
    scene('A girl walks her water buffalo through a rice field at sunrise.', [
      line('b_demo1', 'Narrator', 'narration', 'It is morning. Noy walks to school with her buffalo.', 0.05, 0.04, 0.9, 300, words),
      line('b_demo2', 'Noy', 'speech', "Come on! We're late!", 0.4, 0.2, 0.55, 900, words),
    ], pack),
    scene('The buffalo stops in the middle of the path to eat grass.', [
      line('b_demo3', 'Buffalo', 'thought', 'I am hungry. This grass is good.', 0.05, 0.08, 0.5, 300, words),
    ], pack),
    scene('Noy arrives at school. The teacher is waiting at the door.', [
      line('b_demo4', 'Teacher', 'speech', 'Good morning, Noy! You are late.', 0.05, 0.06, 0.55, 300, words),
      line('b_demo5', 'Noy', 'speech', 'Sorry! My buffalo was hungry.', 0.4, 0.22, 0.55, 1200, words),
    ], pack),
  ];
}

/** The published demo books, with art and word meanings. */
export function demoBooks(pack: DemoPack | null): DemoBook[] {
  return [
    {
      id: 'demo-noy',
      title: 'Noy and the Buffalo',
      description: 'Noy is late for school, and her buffalo will not hurry.',
      level: 'A1',
      created_at: '2026-09-20T12:00:00Z',
      scenes: noyScenes(pack, true),
    },
    {
      id: 'demo-market',
      title: 'Morning Market',
      description: 'Noy buys mangoes at the morning market.',
      level: 'A1',
      created_at: '2026-09-14T09:30:00Z',
      scenes: [
        scene('Early morning at the market. Mango stalls under colorful umbrellas.', [
          line('b_mk1', 'Narrator', 'narration', 'It is early. The market is open.', 0.05, 0.04, 0.9, 300, true),
          line('b_mk2', 'Vendor', 'speech', 'Mangoes! Sweet mangoes!', 0.35, 0.18, 0.6, 1000, true),
        ], pack),
        scene('Noy visits the market and talks to the mango vendor.', [
          line('b_mk3', 'Noy', 'speech', 'Good morning! How much is one mango?', 0.04, 0.05, 0.6, 300, true),
          line('b_mk4', 'Vendor', 'speech', 'Two thousand kip.', 0.4, 0.22, 0.55, 1300, true),
        ], pack),
        scene('Noy buys mangoes at the market stall.', [
          line('b_mk5', 'Noy', 'speech', 'Three mangoes, please.', 0.04, 0.05, 0.55, 300, true),
          line('b_mk6', 'Vendor', 'speech', 'Here you are. Thank you!', 0.4, 0.2, 0.55, 1300, true),
        ], pack),
      ],
    },
  ];
}

/** What a writer sees the first time they open the Studio: a story to continue. */
export function demoDraft(): DemoBook {
  return {
    id: 'draft-noy',
    title: 'Noy and the Buffalo (my draft)',
    description: 'Noy is late for school, and her buffalo will not hurry.',
    level: 'A1',
    created_at: new Date().toISOString(),
    scenes: noyScenes(false, false),
  };
}
