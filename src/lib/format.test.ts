import { describe, it, expect } from 'vitest';
import {
  buildPackage, buildVocab, draftQuiz, emptyScene, mergeTokens, newBubble, publishChecklist,
  readingLevel, retokenize, splitToken, tokenize, tokensMatch, validatePackage,
  type SceneDraft, type Token,
} from './format';

function sceneWith(lines: { text: string; tokens?: Token[]; audio?: string }[], withArt = true): SceneDraft {
  const scene = emptyScene('A rice field at sunrise');
  scene.bubbles = lines.map((l, i) => ({
    ...newBubble(i, 'Noy'),
    text: { en: l.text },
    tokens: l.tokens ? { en: l.tokens } : {},
    audio: l.audio ? { en: l.audio } : {},
  }));
  if (withArt) {
    scene.assets = { bg1: { url: 'bg.webp', bytes: 90000 } };
    scene.layers = [{ id: 'l1', asset: 'bg1', role: 'background', x: 0, y: 0, w: 1, z: 0, prompt: 'field' }];
  }
  return scene;
}

describe('tokens', () => {
  it('splits a line into words and keeps every character', () => {
    const line = "Come on! We're late!";
    const tokens = tokenize(line);
    expect(tokens.map((t) => t.t)).toEqual(['Come ', 'on! ', "We're ", 'late!']);
    expect(tokensMatch(tokens, line)).toBe(true);
  });

  it('keeps meanings and vocab marks when the line is edited', () => {
    const before = tokenize('The buffalo is hungry.');
    before[1] = { ...before[1], gloss: 'a big farm animal', v: 'buffalo' };
    const after = retokenize('The old buffalo is very hungry.', before);
    const buffalo = after.find((t) => t.t.startsWith('buffalo'));
    expect(buffalo).toMatchObject({ gloss: 'a big farm animal', v: 'buffalo' });
    expect(tokensMatch(after, 'The old buffalo is very hungry.')).toBe(true);
  });

  it('joins and splits words', () => {
    const tokens = tokenize('I like ice cream.');
    const merged = mergeTokens(tokens, 2);
    expect(merged.map((t) => t.t)).toEqual(['I ', 'like ', 'ice cream.']);
    expect(splitToken(merged, 2).map((t) => t.t)).toEqual(tokens.map((t) => t.t));
  });
});

describe('vocab and quiz', () => {
  const scenes = [
    sceneWith([
      { text: 'The buffalo is hungry.', tokens: [{ t: 'The ' }, { t: 'buffalo ', gloss: 'a big farm animal', v: 'buffalo' }, { t: 'is ' }, { t: 'hungry.', gloss: 'wanting food', v: 'hungry' }] },
    ]),
    sceneWith([
      { text: 'We are late for school.', tokens: [{ t: 'We ' }, { t: 'are ' }, { t: 'late ', gloss: 'not on time', v: 'late' }, { t: 'for ' }, { t: 'school.' }] },
    ]),
  ];

  it('collects starred words with meanings and example lines', () => {
    const vocab = buildVocab(scenes);
    expect(vocab.map((v) => v.headword)).toEqual(['buffalo', 'hungry', 'late']);
    expect(vocab[0]).toMatchObject({ meaning: 'a big farm animal', example: 'The buffalo is hungry.' });
  });

  it('drafts meaning and fill-the-blank questions with the right answers', () => {
    const quiz = draftQuiz(buildVocab(scenes));
    expect(quiz.length).toBeGreaterThanOrEqual(3);
    expect(quiz.length).toBeLessThanOrEqual(5);
    for (const q of quiz) {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.answer).toBeLessThan(q.options.length);
    }
    const meaning = quiz.find((q) => q.type === 'meaning' && q.prompt === 'buffalo')!;
    expect(meaning.options[meaning.answer]).toBe('a big farm animal');
    const blank = quiz.find((q) => q.type === 'fill-blank')!;
    expect(blank.prompt).toContain('____');
    expect(blank.prompt.replace('____', blank.options[blank.answer])).toMatch(/buffalo|hungry|late/);
  });

  it('needs at least two words with meanings to draft a quiz', () => {
    expect(draftQuiz([{ id: 'a', headword: 'a', meaning: 'x' }])).toEqual([]);
  });
});

describe('publish checklist', () => {
  const settings = { id: 'p1', title: 'Noy and the Buffalo', level: 'A1' as const };

  it('blocks publishing without art or with empty lines', () => {
    const issues = publishChecklist(settings, [sceneWith([{ text: '' }], false)], []);
    const errors = issues.filter((i) => i.level === 'error').map((i) => i.message);
    expect(errors).toContain('No art yet: generate the scene.');
    expect(errors).toContain('Line 1 is empty.');
  });

  it('only warns about missing audio, hard words, vocab and quiz', () => {
    const issues = publishChecklist(settings, [sceneWith([{ text: 'The buffalo is hungry.' }])], [], () => ['buffalo']);
    expect(issues.every((i) => i.level === 'warning')).toBe(true);
    expect(issues.map((i) => i.message).join(' ')).toMatch(/no audio.*above A1: buffalo/s);
  });
});

describe('text on screen', () => {
  it('goes into the shared text, keyed by scene, and only when there is some', () => {
    const scenes = [
      { ...sceneWith([{ text: 'Hello!' }]), caption: '  The next morning.  ' },
      sceneWith([{ text: 'Hi!' }]),
    ];
    const pkg = buildPackage({ id: 'p1', title: 'T', level: 'A1' }, scenes, []);
    expect(pkg.text.captions).toEqual({ '1': { en: 'The next morning.' } });
    expect(buildPackage({ id: 'p1', title: 'T', level: 'A1' }, [sceneWith([{ text: 'Hi!' }])], []).text.captions).toBeUndefined();
  });

  it('counts as words for the scene and is level-checked', () => {
    const settings = { id: 'p1', title: 'T', level: 'A1' as const };
    const scene = { ...sceneWith([], true), bubbles: [], caption: 'The enormous market.' };
    const messages = publishChecklist(settings, [scene], [], (t) => (t.includes('enormous') ? ['enormous'] : [])).map((i) => i.message);
    expect(messages).not.toContain('No dialogue or narration.');
    expect(messages).toContain('Text on screen has words above A1: enormous');
  });
});

describe('package', () => {
  it('shares text across editions and strips authoring-only fields', () => {
    const scenes = Array.from({ length: 5 }, () => sceneWith([{ text: 'Hello!', audio: 'a.webm' }]));
    const pkg = buildPackage({ id: 'p1', title: 'T', level: 'A1' }, scenes, []);

    expect(pkg.manifest.format).toBe('textweaver.motion-comic/2');
    expect(pkg.manifest.editions.lite.chunks.map((c) => c.scenes)).toEqual([[1, 2, 3, 4], [5]]);
    expect(pkg.manifest.editions.hd).toBeUndefined();

    const scene1 = pkg.chunks['lite/chunks/01.json'].scenes[0];
    expect(scene1.layers[0]).not.toHaveProperty('prompt');
    expect(scene1.bubbles[0]).not.toHaveProperty('text');
    const shared = pkg.text.bubbles[scene1.bubbles[0].id];
    expect(shared.text.en).toBe('Hello!');
    expect(tokensMatch(shared.tokens.en, 'Hello!')).toBe(true);
    expect(validatePackage(pkg)).toEqual([]);
  });

  it('reports missing images', () => {
    const pkg = buildPackage({ id: 'p1', title: 'T', level: 'A1' }, [sceneWith([{ text: 'Hi' }])], []);
    pkg.manifest.editions.lite.assets = {};
    expect(validatePackage(pkg)).toEqual(['Scene 1: image bg1 is missing']);
  });
});

it('maps CEFR levels onto the library filter', () => {
  expect([readingLevel('A1'), readingLevel('A2'), readingLevel('B1'), readingLevel('B2')])
    .toEqual(['beginner', 'beginner', 'intermediate', 'advanced']);
});
