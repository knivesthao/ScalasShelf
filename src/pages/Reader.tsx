import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ComicView } from '@/components/ComicView';
import { loadBook, type Book } from '@/lib/books';
import type { AssetRef } from '@/lib/format';
import { addToShelf, savedImageUrls } from '@/lib/offline';

// Reads a published comic (rendering in components/ComicView). Saved books load from the
// phone (no internet needed); others stream from the library.

const STILL_KEY = 'tw-still-mode';

function readStill(): boolean {
  try { return localStorage.getItem(STILL_KEY) === '1'; } catch { return false; }
}

export function Reader() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [assets, setAssets] = useState<Record<string, AssetRef>>({});
  const [error, setError] = useState<string | null>(null);
  const [still, setStill] = useState(readStill);

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
        // Reading a book puts it on the reader's shelf.
        addToShelf(b).catch(() => {});
      })
      .catch(() => setError('This book isn’t on your phone, and there’s no internet connection.'));
    return () => objectUrls.forEach((u) => URL.revokeObjectURL(u));
  }, [id]);

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
        <div className="empty"><p>{error}</p><Link to="/my-shelf" className="buy-btn">My Shelf</Link></div>
      </div>
    );
  }
  if (!book) return <div className="reader"><div className="loading">Loading...</div></div>;

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

      <ComicView pkg={book.package} assets={assets} still={still} footer={<Link to="/" className="ghost-btn">More books</Link>} />
    </div>
  );
}
