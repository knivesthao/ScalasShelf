import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatBytes } from '@/lib/books';
import { listShelf, removeFromShelf, type ShelfEntry, type SavedBook } from '@/lib/offline';

type Item = ShelfEntry & { saved: SavedBook | null };

/** The reader's own shelf: books they added, read or downloaded. Works with no account. */
export function MyShelf() {
  const [books, setBooks] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    listShelf().then(setBooks).catch(() => setBooks([])).finally(() => setLoading(false));
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  async function remove(id: string) {
    await removeFromShelf(id);
    setBooks((list) => list.filter((b) => b.id !== id));
  }

  const saved = books.filter((b) => b.saved);
  const total = saved.reduce((sum, b) => sum + (b.saved?.bytes ?? 0), 0);

  return (
    <div className="my-shelf">
      <header className="library-header">
        <h1>My Shelf</h1>
        <Link to="/">← Find books</Link>
      </header>

      {!online && <p className="offline-banner">You’re offline. Books saved on this phone still work.</p>}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : books.length === 0 ? (
        <div className="empty">
          <p>Your shelf is empty. Add books you like, and every book you read is added here too.</p>
          <Link to="/" className="buy-btn">Find a book</Link>
        </div>
      ) : (
        <>
          <p className="hint">
            {books.length} {books.length === 1 ? 'book' : 'books'}
            {saved.length > 0 && ` · ${saved.length} saved on this phone (${formatBytes(total)})`}
          </p>
          <div className="saved-list">
            {books.map((b) => {
              const canRead = online || b.saved;
              return (
                <div key={b.id} className="saved-item">
                  {b.card.cover_url ? <img src={b.card.cover_url} alt="" /> : <div className="cover-placeholder" aria-hidden>📖</div>}
                  <div className="saved-info">
                    <h2><Link to={`/book/${b.id}`}>{b.card.title}</Link></h2>
                    <span className="badge">{b.card.purpose === 'reading' ? 'Reading' : b.card.level}</span>
                    <span className="hint"> {b.saved ? `Saved · ${formatBytes(b.saved.bytes)}` : 'Needs internet'}</span>
                  </div>
                  <div className="saved-actions">
                    {canRead && <Link to={`/read/${b.id}`} className="buy-btn">Read</Link>}
                    <button className="ghost-btn" onClick={() => remove(b.id)} aria-label={`Remove ${b.card.title} from my shelf`}>Remove</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
