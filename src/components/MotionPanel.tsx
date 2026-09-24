import { useEffect, useRef } from 'react';
import type { Aspect, AssetRef, Bubble, MotionPreset, PublishedLayer } from '@/lib/format';

// Plays one motion-comic panel: image layers + speech bubbles, animated with the
// Web Animations API (no canvas, no engine). Text stays real DOM text so learners
// can tap words and the browser handles wrapping. Shared by the Studio preview and
// the reader. In `editable` mode, layers and bubbles can be selected and dragged.

export type PanelLayer = PublishedLayer & { id?: string };
export type PanelBubble = Pick<Bubble, 'id' | 'speaker' | 'style' | 'x' | 'y' | 'w' | 'motion' | 'text' | 'tokens'>;

interface MotionPanelProps {
  aspect: Aspect;
  layers: PanelLayer[];
  bubbles: PanelBubble[];
  assets: Record<string, AssetRef>;
  /** No animation: reduced motion, data saver or a very old phone. */
  still?: boolean;
  /** Change to replay the entrance animations. */
  playKey?: number;
  editable?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onMove?: (id: string, x: number, y: number) => void;
  onWordTap?: (bubbleId: string, tokenIndex: number) => void;
}

function keyframes(preset: MotionPreset, depth: number): [Keyframe[], KeyframeAnimationOptions] | null {
  switch (preset) {
    case 'kenburns':
      return [[{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }],
        { duration: 8000, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' }];
    case 'parallax':
      return [[{ transform: 'translateX(0)' }, { transform: `translateX(${-1 - depth}%)` }],
        { duration: 6000, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' }];
    case 'idle':
      return [[{ transform: 'translateY(0)' }, { transform: 'translateY(-1.5%)' }],
        { duration: 1600, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' }];
    case 'pop':
      return [[{ transform: 'scale(0.6)', opacity: 0 }, { transform: 'scale(1.05)', opacity: 1, offset: 0.7 },
        { transform: 'scale(1)', opacity: 1 }], { duration: 450, fill: 'backwards', easing: 'ease-out' }];
    case 'shake':
      return [[{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' },
        { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }], { duration: 500 }];
    default:
      return null;
  }
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

const pct = (n: number) => `${n * 100}%`;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function MotionPanel({
  aspect, layers, bubbles, assets, still, playKey = 0,
  editable, selectedId, onSelect, onMove, onWordTap,
}: MotionPanelProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; px: number; py: number; x0: number; y0: number; w: number; h: number } | null>(null);

  const motionKey = JSON.stringify([
    layers.map((l) => [l.asset, l.motion?.preset, l.motion?.delay]),
    bubbles.map((b) => [b.id, b.motion?.preset, b.motion?.delay]),
  ]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || still || prefersReducedMotion()) return;
    const running: Animation[] = [];
    root.querySelectorAll<HTMLElement>('[data-motion]').forEach((el) => {
      if (typeof el.animate !== 'function') return;
      const spec = keyframes(el.dataset.motion as MotionPreset, Number(el.dataset.depth ?? 0));
      if (!spec) return;
      const [frames, opts] = spec;
      running.push(el.animate(frames, { ...opts, delay: Number(el.dataset.delay ?? 0) }));
    });
    return () => running.forEach((a) => a.cancel());
  }, [motionKey, still, playKey]);

  function startDrag(e: React.PointerEvent, id: string | undefined, x: number, y: number, locked: boolean) {
    if (!editable || !id) return;
    e.stopPropagation();
    onSelect?.(id);
    if (locked || !onMove || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    drag.current = { id, px: e.clientX, py: e.clientY, x0: x, y0: y, w: rect.width || 1, h: rect.height || 1 };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function moveDrag(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    onMove?.(d.id, clamp(d.x0 + (e.clientX - d.px) / d.w, -0.4, 0.95), clamp(d.y0 + (e.clientY - d.py) / d.h, -0.4, 0.95));
  }

  const sorted = [...layers].sort((a, b) => a.z - b.z);

  return (
    <div
      ref={rootRef}
      className={`motion-panel${editable ? ' motion-panel--editable' : ''}`}
      style={{ aspectRatio: aspect.replace(':', ' / ') }}
      onPointerDown={() => editable && onSelect?.(null)}
      onPointerMove={moveDrag}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
    >
      {sorted.map((layer, i) => {
        const asset = assets[layer.asset];
        if (!asset) return null;
        const id = layer.id;
        return (
          <img
            key={id ?? `${layer.asset}-${i}`}
            src={asset.url}
            alt=""
            draggable={false}
            className={`mp-layer mp-layer--${layer.role}${id && id === selectedId ? ' is-selected' : ''}`}
            style={{ left: pct(layer.x), top: pct(layer.y), width: pct(layer.w), zIndex: layer.z }}
            data-motion={layer.motion?.preset}
            data-delay={layer.motion?.delay}
            data-depth={layer.z}
            onPointerDown={(e) => startDrag(e, id, layer.x, layer.y, layer.role === 'background')}
          />
        );
      })}

      {bubbles.map((b) => {
        const tokens = b.tokens.en;
        const useTokens = !!onWordTap && !!tokens && tokens.map((t) => t.t).join('') === b.text.en;
        return (
          <div
            key={b.id}
            lang="en"
            className={`mp-bubble mp-bubble--${b.style}${b.id === selectedId ? ' is-selected' : ''}`}
            style={{ left: pct(b.x), top: pct(b.y), width: pct(b.w) }}
            data-motion={b.motion?.preset}
            data-delay={b.motion?.delay}
            onPointerDown={(e) => startDrag(e, b.id, b.x, b.y, false)}
          >
            {useTokens
              ? tokens!.map((tk, i) => (
                  <span
                    key={i}
                    className={`mp-word${tk.v ? ' mp-word--vocab' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onWordTap!(b.id, i)}
                    onKeyDown={(e) => { if (e.key === 'Enter') onWordTap!(b.id, i); }}
                  >
                    {tk.t}
                  </span>
                ))
              : b.text.en || <span className="mp-placeholder">…</span>}
          </div>
        );
      })}
    </div>
  );
}
