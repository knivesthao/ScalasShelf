import { describe, it, expect } from 'vitest';
import { adoptCast, composeScene, putMember, removeMember, sceneCharacters, usedIn } from './cast';
import { emptyCast, emptyScene, newBubble, type SceneDraft } from './format';

function scene(description: string, lines: [speaker: string, style?: 'speech' | 'narration'][]): SceneDraft {
  return {
    ...emptyScene(description),
    bubbles: lines.map(([speaker, style = 'speech'], i) => ({ ...newBubble(i, speaker), style, text: { en: 'Hi.' } })),
  };
}

describe('adoptCast', () => {
  it('makes one place per distinct description and one character per name, and links them', () => {
    const scenes = [
      scene('A rice field at sunrise. Birds fly.', [['Noy'], ['Buffalo'], ['', 'narration']]),
      scene('A rice field at sunrise. Birds fly.', [['noy']]),
      scene('The school yard', [['Teacher']]),
    ];
    const result = adoptCast(emptyCast(), scenes)!;
    expect(result.cast.places.map((p) => p.name)).toEqual(['A rice field at sunrise', 'The school yard']);
    expect(result.cast.characters.map((c) => c.name)).toEqual(['Noy', 'Buffalo', 'Teacher']);
    expect(result.scenes[0].placeId).toBe(result.scenes[1].placeId);
    expect(result.scenes[1].bubbles[0]).toMatchObject({ characterId: result.cast.characters[0].id, speaker: 'Noy' });
    expect(result.scenes[0].bubbles[2].characterId).toBeUndefined(); // narration
  });

  it('keeps an existing background as the place’s picture', () => {
    const s = { ...scene('Market', []), assets: { bg: { url: 'bg.webp' } }, layers: [{ id: 'l', asset: 'bg', role: 'background' as const, x: 0, y: 0, w: 1, z: 0 }] };
    expect(adoptCast(emptyCast(), [s])!.cast.places[0].asset).toEqual({ url: 'bg.webp' });
  });

  it('does nothing once everything is linked', () => {
    const first = adoptCast(emptyCast(), [scene('Market', [['Noy']])])!;
    expect(adoptCast(first.cast, first.scenes)).toBeNull();
    expect(adoptCast(emptyCast(), [emptyScene()])).toBeNull();
  });
});

describe('cast helpers', () => {
  const noy = { id: 'c1', name: 'Noy', description: 'a girl' };

  it('adds, replaces and removes members', () => {
    let cast = putMember(emptyCast(), 'character', noy);
    cast = putMember(cast, 'character', { ...noy, name: 'Noy K.' });
    expect(cast.characters).toEqual([{ ...noy, name: 'Noy K.' }]);
    expect(removeMember(cast, 'character', 'c1').characters).toEqual([]);
  });

  it('finds where a member is used and who is in a scene', () => {
    const s = { ...scene('x', [['Noy'], ['', 'narration']]), placeId: 'p1' };
    s.bubbles[0].characterId = 'c1';
    const cast = putMember(emptyCast(), 'character', noy);
    expect(usedIn([emptyScene(), s], 'character', 'c1')).toEqual([2]);
    expect(usedIn([s], 'place', 'p1')).toEqual([1]);
    expect(sceneCharacters(s, cast)).toEqual([noy]);
  });

  it('lays out a place and characters with no image model', () => {
    const art = composeScene(
      { id: 'bg', asset: { url: 'bg.webp' }, prompt: 'market' },
      [{ id: 'a', asset: { url: 'a.webp', width: 200, height: 320 }, name: 'Noy' }, { id: 'b', asset: { url: 'b.webp' }, name: 'Kham' }],
    );
    expect(art.layers.map((l) => [l.role, l.asset])).toEqual([['background', 'bg'], ['character', 'a'], ['character', 'b']]);
    expect(Object.keys(art.assets)).toEqual(['bg', 'a', 'b']);
  });
});
