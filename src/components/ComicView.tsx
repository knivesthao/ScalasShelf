import { useEffect, useMemo, useRef, useState } from 'react';
import { MotionPanel, type PanelBubble } from '@/components/MotionPanel';
import { Quiz } from '@/components/Quiz';
import { bareWord, type AssetRef, type Package, type PublishedScene, type Token } from '@/lib/format';

// A comic as children read it: panels in a vertical scroll, each animating when it comes
// into view, words tappable for their meaning, and the quiz at the end. Used by the Reader
// and by reviewers, who check exactly this before a book is published.

/** Replays a panel's entrance animation each time it scrolls into view. */
function InView({ children }: { children: (playKey: number) => React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [playKey, setPlayKey] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setPlayKey((k) => k + 1); }, { threshold: 0.5 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className="reader-panel">{children(playKey)}</div>;
}

interface ComicViewProps {
  pkg: Package;
  assets: Record<string, AssetRef>;
  still: boolean;
  /** Shown after the quiz (e.g. "More books"). */
  footer?: React.ReactNode;
}

export function ComicView({ pkg, assets, still, footer }: ComicViewProps) {
  const [word, setWord] = useState<{ token: Token } | null>(null);
  const { manifest, chunks, text } = pkg;

  const scenes: PublishedScene[] = useMemo(
    () => manifest.editions.lite.chunks.flatMap((c) => chunks[c.url]?.scenes ?? []),
    [manifest, chunks],
  );

  const bubblesFor = (scene: PublishedScene): PanelBubble[] =>
    scene.bubbles.map((b) => ({ ...b, text: text.bubbles[b.id]?.text ?? { en: '' }, tokens: text.bubbles[b.id]?.tokens ?? {} }));

  return (
    <>
      <div className="reader-scroll">
        {scenes.map((scene) => (
          <InView key={scene.n}>
            {(playKey) => (
              <MotionPanel
                aspect={scene.aspect}
                layers={scene.layers}
                bubbles={bubblesFor(scene)}
                assets={assets}
                caption={text.captions?.[String(scene.n)]?.en}
                still={still}
                playKey={playKey}
                onWordTap={(bubbleId, i) => {
                  const token = text.bubbles[bubbleId]?.tokens.en?.[i];
                  if (token) setWord({ token });
                }}
              />
            )}
          </InView>
        ))}

        <section className="reader-end">
          {text.quiz.length > 0 ? (
            <>
              <h2>Check your understanding</h2>
              <Quiz items={text.quiz} />
            </>
          ) : (
            <h2>The End</h2>
          )}
          {footer}
        </section>
      </div>

      {word && (
        <div className="word-sheet" role="dialog" aria-label="Word meaning" onClick={() => setWord(null)}>
          <div className="word-sheet-card" onClick={(e) => e.stopPropagation()}>
            <p className="word-sheet-word" lang="en">{bareWord(word.token.t)}</p>
            {word.token.v && <span className="badge">New word</span>}
            <p className="word-sheet-meaning">{word.token.gloss || 'No meaning added for this word yet.'}</p>
            <button className="ghost-btn" onClick={() => setWord(null)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
