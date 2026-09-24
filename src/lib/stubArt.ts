// Placeholder art for demo/dev mode, standing in for the cloud image model.
// Plain SVG shapes, and never any text: dialogue always stays in the bubbles.

import { newId, type AssetRef, type Layer } from './format';

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function toAsset(svg: string, width: number, height: number): AssetRef {
  return { url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, bytes: svg.length, width, height };
}

const has = (text: string, words: string[]) => words.some((w) => text.includes(w));

export function stubBackground(description: string, seed = 0): AssetRef {
  const d = description.toLowerCase();
  const sky = has(d, ['night', 'dark', 'moon', 'star'])
    ? ['#0b1030', '#2a2f6b']
    : has(d, ['sunset', 'evening', 'dusk'])
      ? ['#ff9a5a', '#7b3f8f']
      : has(d, ['sunrise', 'dawn'])
        ? ['#ffd29a', '#8fc7ff']
      : has(d, ['rain', 'storm', 'cloud'])
        ? ['#6b7a8f', '#9aa6b5']
        : ['#8fd3ff', '#e8f6ff'];
  const ground = has(d, ['city', 'road', 'street', 'market', 'shop'])
    ? '#7d7d86'
    : has(d, ['field', 'farm', 'rice', 'forest', 'garden', 'grass', 'tree'])
      ? '#5daa4f'
      : has(d, ['river', 'lake', 'sea'])
        ? '#3f86c4'
        : '#c9a978';
  const night = sky[0] === '#0b1030';
  const shift = (seed * 37) % 80;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 640" width="360" height="640">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[1]}"/><stop offset="1" stop-color="${sky[0]}"/></linearGradient></defs>
<rect width="360" height="640" fill="url(#s)"/>
<circle cx="${250 - shift}" cy="${150 + shift / 2}" r="38" fill="${night ? '#f4f1c9' : '#ffe27a'}" opacity="0.9"/>
<path d="M0 400 Q ${90 + shift} 320 180 380 T 360 360 V 640 H 0 Z" fill="${ground}" opacity="0.65"/>
<path d="M0 460 Q 120 420 240 450 T 360 440 V 640 H 0 Z" fill="${ground}"/>
</svg>`;
  return toAsset(svg, 360, 640);
}

export function stubCharacter(name: string, seed = 0): AssetRef {
  const hue = (hash(name || 'someone') + seed * 53) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 320" width="200" height="320">
<ellipse cx="100" cy="305" rx="55" ry="10" fill="#000" opacity="0.18"/>
<path d="M45 300 Q 45 170 100 160 Q 155 170 155 300 Z" fill="hsl(${hue} 55% 50%)"/>
<circle cx="100" cy="110" r="52" fill="#e9b98f"/>
<path d="M48 104 Q 55 50 100 52 Q 148 52 152 104 Q 130 80 100 82 Q 70 80 48 104 Z" fill="hsl(${(hue + 200) % 360} 30% 18%)"/>
<circle cx="82" cy="115" r="6" fill="#2b1d14"/><circle cx="118" cy="115" r="6" fill="#2b1d14"/>
<path d="M86 138 Q 100 148 114 138" stroke="#9c5a3c" stroke-width="4" fill="none" stroke-linecap="round"/>
</svg>`;
  return toAsset(svg, 200, 320);
}

// ---- Demo art pack (public/demo-art, made by scripts/generate-demo-art.py) ----

export interface DemoPack {
  backgrounds: { id: string; file: string; keywords: string[]; width: number; height: number; bytes: number }[];
  characters: { id: string; file: string; names: string[]; width: number; height: number; bytes: number }[];
}

const PACK_BASE = '/demo-art/';
let packPromise: Promise<DemoPack | null> | null = null;

/** Loads the pack once; null if it isn't there (demo mode then uses plain shapes). */
export function loadDemoPack(): Promise<DemoPack | null> {
  packPromise ??= fetch(`${PACK_BASE}pack.json`)
    .then((r) => (r.ok ? (r.json() as Promise<DemoPack>) : null))
    .catch(() => null);
  return packPromise;
}

const words = (text: string) => text.toLowerCase().match(/[a-z]+/g) ?? [];

/** Background whose keywords best match the scene description; `skip` excludes the current one on re-roll. */
export function packBackground(pack: DemoPack, description: string, skip?: string): { id: string; asset: AssetRef } | null {
  const text = new Set(words(description));
  const ranked = pack.backgrounds
    .filter((b) => b.id !== skip)
    .map((b) => ({ b, score: b.keywords.filter((k) => text.has(k)).length }))
    .filter((r) => r.score > 0)
    .sort((x, y) => y.score - x.score);
  const hit = ranked[0]?.b ?? (skip ? pack.backgrounds.find((b) => b.id !== skip) : undefined);
  return hit ? { id: hit.id, asset: { url: PACK_BASE + hit.file, bytes: hit.bytes, width: hit.width, height: hit.height } } : null;
}

export function packCharacter(pack: DemoPack, speaker: string): { id: string; asset: AssetRef } | null {
  const name = new Set(words(speaker));
  const hit = pack.characters.find((c) => c.names.some((n) => name.has(n)));
  return hit ? { id: hit.id, asset: { url: PACK_BASE + hit.file, bytes: hit.bytes, width: hit.width, height: hit.height } } : null;
}

// ---- Laying out a scene ----

/** Character height as a fraction of the panel's height, and where their feet land. */
const CHARACTER_HEIGHT = 0.42;
const GROUND = 0.94;

export function stubSceneArt(
  req: { description: string; characters: string[] },
  pack: DemoPack | null = null
): { layers: Layer[]; assets: Record<string, AssetRef> } {
  const bg = (pack && packBackground(pack, req.description)) ?? { id: newId('bg'), asset: stubBackground(req.description) };
  const assets: Record<string, AssetRef> = { [bg.id]: bg.asset };
  const layers: Layer[] = [
    { id: newId('l'), asset: bg.id, role: 'background', x: 0, y: 0, w: 1, z: 0, motion: { preset: 'kenburns' }, prompt: req.description },
  ];

  const cast = req.characters.slice(0, 3);
  const slot = 1 / Math.max(1, cast.length);
  cast.forEach((name, i) => {
    const hit = (pack && packCharacter(pack, name)) ?? { id: newId('ch'), asset: stubCharacter(name) };
    assets[hit.id] = hit.asset;
    // Size by height so a wide buffalo and a tall girl stand at the same scale.
    // Panel is 9:16, so its height is 16/9 panel-widths.
    const aspect = (hit.asset.width ?? 200) / (hit.asset.height ?? 320);
    const w = Math.min(slot * 0.95, CHARACTER_HEIGHT * (16 / 9) * aspect);
    const h = (w / aspect) * (9 / 16);
    layers.push({
      id: newId('l'),
      asset: hit.id,
      role: 'character',
      x: slot * i + (slot - w) / 2,
      y: GROUND - h,
      w,
      z: i + 1,
      motion: { preset: 'idle' },
      prompt: name,
    });
  });
  return { layers, assets };
}
