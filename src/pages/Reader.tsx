import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MotionPanel, type PanelBubble } from '@/components/MotionPanel';
import { Quiz } from '@/components/Quiz';
import { loadBook, type Book } from '@/lib/books';
import { bareWord, type AssetRef, type PublishedScene, type Token } from '@/lib/format';
import { savedImageUrls } from '@/lib/offline';

// Reads a published comic: panels in a vertical scroll, each animating when it comes
// into view, words tappable for their meaning, and the quiz at the end. Saved books
// load from the phone (no internet needed); others stream from the library.

const STILL_KEY = 'tw-still-mode';

function readStill(): boolean {
  try { return localStorage.getItem(STILL_KEY) === '1'; } catch { return false; }
}

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

export function Reader() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [assets, setAssets] = useState<Record<string, AssetRef>>({});
  const [error, setError] = useState<string | null>(null);
  const [still, setStill] = useState(readStill);
  const [word, setWord] = useState<{ token: Token } | null>(null);

  useEffect(() => {
    if (!id) return;
    let objectUrls: string[] = [];
    loadBook(id)
      .then(async ({ book: b, saved }) => {
        const lite = b.package.manifest.editions.lite.assets;
        if (saved) {
          const urls = await savedImageUrls(b);
          objectUrls = Object.values(urls);
          setAssets(Object.fromEntries(Object.entries(lite).map(([k, a]) => [k, { ...a, url: urls[k] ?? a.url }])));
        } else {
          setAssets(lite);
        }
        setBook(b);
      })
      .catch(() => setError('This book isn’t on your phone, and there’s no internet connection.'));
    return () => objectUrls.forEach((u) => URL.revokeObjectURL(u));
  }, [id]);

  const scenes: PublishedScene[] = useMemo(() => {
    if (!book) return [];
    const { manifest, chunks } = book.package;
    return manifest.editions.lite.chunks.flatMap((c) => chunks[c.url]?.scenes ?? []);
  }, [book]);

  function toggleStill() {
    setStill((s) => {
      try { localStorage.setItem(STILL_KEY, s ? '0' : '1'); } catch { /* private mode */ }
      return !s;
    });
  }

  if (error) {
    return (
      <div className="reader">
        <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
        <div className="empty"><p>{error}</p><Link to="/my-library" className="buy-btn">My Library</Link></div>
      </div>
    );
  }
  if (!book) return <div className="reader"><div className="loading">Loading...</div></div>;

  const { text } = book.package;
  const bubblesFor = (scene: PublishedScene): PanelBubble[] =>
    scene.bubbles.map((b) => ({ ...b, text: text.bubbles[b.id]?.text ?? { en: '' }, tokens: text.bubbles[b.id]?.tokens ?? {} }));

  return (
    <div className="reader">
      <div className="reader-toolbar">
        <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
        <h1 className="reader-title">{book.title}</h1>
        <label className="toggle">
          <input type="checkbox" checked={still} onChange={toggleStill} />
          Still
        </label>
      </div>

      <p className="hint reader-hint">Tap any word to see what it means.</p>

      <div className="reader-scroll">
        {scenes.map((scene) => (
          <InView key={scene.n}>
            {(playKey) => (
              <MotionPanel
                aspect={scene.aspect}
                layers={scene.layers}
                bubbles={bubblesFor(scene)}
                assets={assets}
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
          <Link to="/" className="ghost-btn">More books</Link>
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
    </div>
  );
}
