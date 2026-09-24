import { describe, it, expect } from 'vitest';
import { hasWordList, wordsAboveLevel } from './levels';

describe('wordsAboveLevel', () => {
  it('passes simple A1 lines, including inflected forms and contractions', () => {
    expect(wordsAboveLevel("Come on! We're late! She walked to school.", 'A1')).toEqual([]);
    expect(wordsAboveLevel('The girls are playing with the cats.', 'A1')).toEqual([]);
  });

  it('flags words above the level, once each', () => {
    expect(wordsAboveLevel('The buffalo eats grass. The buffalo is brave.', 'A1')).toEqual(['buffalo', 'brave']);
  });

  it('allows A2 words at A2', () => {
    expect(wordsAboveLevel('The buffalo is brave.', 'A2')).toEqual([]);
  });

  it('skips levels without a list yet', () => {
    expect(hasWordList('B1')).toBe(false);
    expect(wordsAboveLevel('Photosynthesis is fascinating.', 'B1')).toEqual([]);
  });
});

describe('names', () => {
  it('does not flag character names or other proper nouns', () => {
    expect(wordsAboveLevel('It is morning. The girl walks to Vientiane.', 'A1')).toEqual([]);
    expect(wordsAboveLevel('It is morning. Noy walks to school.', 'A1', ['Noy'])).toEqual([]);
    expect(wordsAboveLevel('Somchai is here.', 'A1', ['Somchai'])).toEqual([]);
  });

  it('still checks capitalized words at the start of a sentence', () => {
    expect(wordsAboveLevel('Buffalo eat grass.', 'A1')).toEqual(['buffalo']);
  });
});
