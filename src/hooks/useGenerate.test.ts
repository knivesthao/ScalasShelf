import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGenerate, stubSceneArt } from './useGenerate';

describe('stubSceneArt', () => {
  it('makes a background plus one character layer per speaker', () => {
    const art = stubSceneArt({ description: 'rice field at sunset', characters: ['Noy', 'Buffalo'] });
    expect(art.layers.map((l) => l.role)).toEqual(['background', 'character', 'character']);
    expect(art.layers.map((l) => l.z)).toEqual([0, 1, 2]);
    for (const layer of art.layers) expect(art.assets[layer.asset]?.url).toMatch(/^data:image\/svg\+xml/);
  });

  it('never bakes text into the art', () => {
    const art = stubSceneArt({ description: 'night', characters: ['Noy'] });
    for (const asset of Object.values(art.assets)) expect(decodeURIComponent(asset.url)).not.toMatch(/<text/);
  });
});

describe('useGenerate (dev mode)', () => {
  it('returns placeholder art after a short delay, without calling the render API', async () => {
    vi.useFakeTimers();
    // No demo art pack available → plain shapes.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));
    const { result } = renderHook(() => useGenerate());

    const pending = result.current.generateScene({ projectId: 'p', sceneId: 's', description: 'field', characters: ['Noy'] });
    await act(async () => { await vi.runAllTimersAsync(); });
    const art = await pending;

    expect(art.layers).toHaveLength(2);
    expect(fetchSpy.mock.calls.map(([url]) => String(url))).toEqual(['/demo-art/pack.json']);
    fetchSpy.mockRestore();
    vi.useRealTimers();
  });
});

describe('stubSceneArt with the demo art pack', () => {
  const pack = {
    backgrounds: [
      { id: 'bg-ricefield-sunrise', file: 'bg-ricefield-sunrise.webp', keywords: ['rice', 'field', 'sunrise'], width: 576, height: 1024, bytes: 1 },
      { id: 'bg-school', file: 'bg-school.webp', keywords: ['school'], width: 576, height: 1024, bytes: 1 },
    ],
    characters: [
      { id: 'ch-noy', file: 'ch-noy.webp', names: ['noy'], width: 316, height: 800, bytes: 1 },
      { id: 'ch-buffalo', file: 'ch-buffalo.webp', names: ['buffalo'], width: 800, height: 738, bytes: 1 },
    ],
  };

  it('matches the background by keywords and characters by speaker name', () => {
    const art = stubSceneArt({ description: 'Noy walks to school', characters: ['Noy', 'Buffalo', 'Somchai'] }, pack);
    expect(art.layers.map((l) => l.asset)).toEqual(['bg-school', 'ch-noy', 'ch-buffalo', expect.stringMatching(/^ch_/)]);
    expect(art.assets['ch-noy'].url).toBe('/demo-art/ch-noy.webp');
    expect(art.assets[art.layers[3].asset].url).toMatch(/^data:image\/svg/); // no pack art for Somchai
  });

  it('stands characters on the same ground line, whatever their shape', () => {
    const art = stubSceneArt({ description: 'rice field', characters: ['Noy', 'Buffalo'] }, pack);
    const [, noy, buffalo] = art.layers;
    const bottom = (l: typeof noy, a: { width: number; height: number }) => l.y + (l.w * a.height / a.width) * (9 / 16);
    expect(bottom(noy, pack.characters[0])).toBeCloseTo(0.94);
    expect(bottom(buffalo, pack.characters[1])).toBeCloseTo(0.94);
    expect(noy.x + noy.w).toBeLessThanOrEqual(buffalo.x);
  });

  it('falls back to shapes when nothing matches', () => {
    const art = stubSceneArt({ description: 'outer space', characters: [] }, pack);
    expect(art.assets[art.layers[0].asset].url).toMatch(/^data:image\/svg/);
  });
});
