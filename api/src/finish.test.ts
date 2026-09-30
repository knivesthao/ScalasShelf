// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { TextModel } from './platform';
import { finishProject } from './services/finish';
import { testApi } from './testing';

const answer = {
  scenes: [
    { place: 'River', picture: 'Noy and the buffalo at the river', caption: '', lines: [
      { speaker: '', text: 'They walk to the river.' },
      { speaker: 'Noy', text: 'Drink, buffalo. Then we run.' },
      { speaker: 'Kham', text: 'You are late again, Noy!' },
    ] },
    { place: 'School', picture: 'Noy at school', caption: 'The End', lines: [{ speaker: 'Noy', text: 'I am here, teacher!' }] },
  ],
  characters: [{ name: 'Kham', description: 'A tall boy with a red shirt' }],
  places: [{ name: 'River', description: 'A wide brown river' }],
  words: [{ word: 'river', meaning: 'a long stream of water' }],
};
const fake: TextModel = { name: 'fake/model', complete: async () => ({ text: JSON.stringify(answer) }) };

describe('Scala Finish', () => {
  it('adds the new scenes after the written ones, grows the cast and marks the new words', async () => {
    const { db } = await testApi();
    const before = await finishProject(db, undefined, 'demo-creator', 'demo-noy').catch((e: Error) => e.message);
    expect(before).toMatch(/AI isn’t set up here/);

    const book = await finishProject(db, fake, 'demo-creator', 'demo-noy');
    expect(book.scenes).toHaveLength(5); // the 3 written demo scenes, then 2 new ones
    expect(book.first_new_scene).toBe(3);
    const added = book.scenes[3].data;
    expect(added.bubbles.map((b) => [b.style, b.speaker, b.text.en])).toEqual([
      ['narration', '', 'They walk to the river.'],
      ['speech', 'Noy', 'Drink, buffalo. Then we run.'],
      ['speech', 'Kham', 'You are late again, Noy!'],
    ]);
    expect(book.project.cast.characters.map((c) => c.name)).toContain('Kham');
    expect(book.project.cast.places.find((p) => p.name === 'River')?.description).toBe('A wide brown river');
    const river = added.bubbles[0].tokens.en?.find((t) => t.v);
    expect(river).toMatchObject({ v: 'river', gloss: 'a long stream of water' });
  });
});
