import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatBytes } from '@/lib/books';
import { listSavedBooks, removeSavedBook, type SavedBook } from '@/lib/offline';

/** Books saved on this phone. Works with no account and no internet. */
export function MyLibrary() {
  const [books, setBooks] = useState<SavedBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    listSavedBooks().then(setBooks).catch(() => setBooks([])).finally(() => setLoading(false));
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  async function remove(id: string) {
    await removeSavedBook(id);
    setBooks((list) => list.filter((b) => b.id !== id));
  }

  const total = books.reduce((sum, b) => sum + b.bytes, 0);

  return (
    <div className="my-library">
      <header className="library-header">
        <h1>My Library</h1>
        <Link to="/">← Browse books</Link>
      </header>

      {!online && <p className="offline-banner">You’re offline. Your saved books still work.</p>}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : books.length === 0 ? (
        <div className="empty">
          <p>Books you download appear here, and you can read them without internet.</p>
          <Link to="/" className="buy-btn">Find a book</Link>
        </div>
      ) : (
        <>
          <p className="hint">{books.length} {books.length === 1 ? 'book' : 'books'} · {formatBytes(total)} on this phone</p>
          <div className="saved-list">
            {books.map((b) => (
              <div key={b.id} className="saved-item">
                {b.card.cover_url ? <img src={b.card.cover_url} alt="" /> : <div className="cover-placeholder" aria-hidden>📖</div>}
                <div className="saved-info">
                  <h2>{b.card.title}</h2>
                  <span className="badge">{b.card.level}</span>
                  <span className="hint"> {formatBytes(b.bytes)}</span>
                </div>
                <div className="saved-actions">
                  <Link to={`/read/${b.id}`} className="buy-btn">Read</Link>
                  <button className="ghost-btn" onClick={() => remove(b.id)} aria-label={`Remove ${b.card.title}`}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
