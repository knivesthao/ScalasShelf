// The episode's cast: characters and places, each drawn once and reused in every scene,
// so Noy looks like Noy on every page and art is paid for once, not per scene.
// Scenes point at a place (SceneDraft.placeId); lines point at a character (Bubble.characterId).

import { newId, type AssetRef, type Cast, type CastMember, type Layer, type SceneDraft } from './format';

export type CastKind = 'character' | 'place';

export const castList = (cast: Cast, kind: CastKind) => (kind === 'character' ? cast.characters : cast.places);

/** Adds or replaces one member. */
export function putMember(cast: Cast, kind: CastKind, member: CastMember): Cast {
  const list = castList(cast, kind);
  const next = list.some((m) => m.id === member.id) ? list.map((m) => (m.id === member.id ? member : m)) : [...list, member];
  return kind === 'character' ? { ...cast, characters: next } : { ...cast, places: next };
}

export function removeMember(cast: Cast, kind: CastKind, id: string): Cast {
  return kind === 'character'
    ? { ...cast, characters: cast.characters.filter((m) => m.id !== id) }
    : { ...cast, places: cast.places.filter((m) => m.id !== id) };
}

/** Scene numbers (1-based) that use a member. */
export function usedIn(scenes: SceneDraft[], kind: CastKind, id: string): number[] {
  return scenes.flatMap((s, i) =>
    (kind === 'place' ? s.placeId === id : s.bubbles.some((b) => b.characterId === id)) ? [i + 1] : []);
}

/** Characters who speak or think in a scene, in order of their first line (narration has none). */
export function sceneCharacters(scene: SceneDraft, cast: Cast): CastMember[] {
  const ids = [...new Set(scene.bubbles.filter((b) => b.style !== 'narration' && b.characterId).map((b) => b.characterId!))];
  return ids.map((id) => cast.characters.find((c) => c.id === id)).filter((c): c is CastMember => !!c);
}

/** A short name for a place made from an older free-text scene description. */
function placeName(description: string): string {
  const words = description.replace(/[.!?].*$/s, '').trim().split(/\s+/).slice(0, 5).join(' ');
  return words ? words[0].toUpperCase() + words.slice(1) : 'Place';
}

/**
 * Drafts made before the cast existed have free-text scene descriptions and typed speaker
 * names. This builds a cast from them (one place per distinct description, one character per
 * name) and links every scene and line to it. Returns null when there's nothing to adopt.
 */
export function adoptCast(cast: Cast, scenes: SceneDraft[]): { cast: Cast; scenes: SceneDraft[] } | null {
  let next = cast;
  let changed = false;

  const linked = scenes.map((scene) => {
    let s = scene;
    const description = scene.description.trim();
    if (!scene.placeId && description) {
      let place = next.places.find((p) => p.description.trim() === description);
      if (!place) {
        const bg = scene.layers.find((l) => l.role === 'background');
        place = { id: newId('place'), name: placeName(description), description, asset: bg ? scene.assets[bg.asset] : undefined };
        next = putMember(next, 'place', place);
      }
      s = { ...s, placeId: place.id };
      changed = true;
    }
    const bubbles = s.bubbles.map((b) => {
      const name = b.speaker.trim();
      if (b.characterId || b.style === 'narration' || !name) return b;
      let character = next.characters.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (!character) {
        character = { id: newId('char'), name, description: '' };
        next = putMember(next, 'character', character);
      }
      changed = true;
      return { ...b, characterId: character.id, speaker: character.name };
    });
    return bubbles === s.bubbles ? s : { ...s, bubbles };
  });

  return changed ? { cast: next, scenes: linked } : null;
}

// ---- Laying out a scene from cast art ----

/** Character height as a fraction of the panel's height, and where their feet land. */
const CHARACTER_HEIGHT = 0.42;
const GROUND = 0.94;

/**
 * Background plus up to three characters standing side by side, all at the same scale.
 * No image model involved: the pictures come from the cast (or the demo art).
 */
export function composeScene(
  background: { id: string; asset: AssetRef; prompt: string },
  characters: { id: string; asset: AssetRef; name: string }[],
): { layers: Layer[]; assets: Record<string, AssetRef> } {
  const assets: Record<string, AssetRef> = { [background.id]: background.asset };
  const layers: Layer[] = [
    { id: newId('l'), asset: background.id, role: 'background', x: 0, y: 0, w: 1, z: 0, motion: { preset: 'kenburns' }, prompt: background.prompt },
  ];

  const shown = characters.slice(0, 3);
  const slot = 1 / Math.max(1, shown.length);
  shown.forEach((c, i) => {
    assets[c.id] = c.asset;
    // Size by height so a wide buffalo and a tall girl stand at the same scale.
    // Panel is 9:16, so its height is 16/9 panel-widths.
    const aspect = (c.asset.width ?? 200) / (c.asset.height ?? 320);
    const w = Math.min(slot * 0.95, CHARACTER_HEIGHT * (16 / 9) * aspect);
    const h = (w / aspect) * (9 / 16);
    layers.push({
      id: newId('l'),
      asset: c.id,
      role: 'character',
      x: slot * i + (slot - w) / 2,
      y: GROUND - h,
      w,
      z: i + 1,
      motion: { preset: 'idle' },
      prompt: c.name,
    });
  });
  return { layers, assets };
}
