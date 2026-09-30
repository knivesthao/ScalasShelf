import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listBooks, type BookCard } from '@/lib/books';
import { LEVELS, type Level } from '@/lib/format';
import { READER_ONLY } from '@/lib/features';

export function Library() {
  const [books, setBooks] = useState<BookCard[]>([]);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<Level | ''>('');
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setLoading(true);
    listBooks(level || undefined)
      .then((list) => { setBooks(list); setOffline(false); })
      .catch(() => setOffline(true))
      .finally(() => setLoading(false));
  }, [level]);

  const query = search.trim().toLowerCase();
  const filtered = books.filter((b) => !query || `${b.title} ${b.description}`.toLowerCase().includes(query));

  return (
    <div className="library">
      <header className="library-header">
        <h1 className="brand">
          <img src="/logo.webp" alt="Scala’s Shelf" width="400" height="178" />
        </h1>
        <nav className="header-nav">
          <Link to="/my-shelf">My Shelf</Link>
          {!READER_ONLY && <Link to="/studio">Studio</Link>}
        </nav>
      </header>

      <p className="tagline">Free English comics for learners. Download them and read anywhere, even without internet.</p>

      <div className="filters">
        <input
          type="search"
          placeholder="Search books..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
          aria-label="Search books"
        />
        <select value={level} onChange={(e) => setLevel(e.target.value as Level | '')} aria-label="Filter by level">
          <option value="">All levels</option>
          {LEVELS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : offline ? (
        <div className="empty">
          <p>You’re offline. Books saved on this phone are still on your shelf:</p>
          <Link to="/my-shelf" className="buy-btn">Open My Shelf</Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty"><p>No books found.</p></div>
      ) : (
        <div className="content-grid" role="list">
          {filtered.map((book) => (
            <Link to={`/book/${book.id}`} key={book.id} className="content-card" role="listitem">
              {book.cover_url ? (
                <img src={book.cover_url} alt="" loading="lazy" />
              ) : (
                <div className="cover-placeholder" aria-hidden>📖</div>
              )}
              <div className="card-body">
                <h2>{book.title}</h2>
                <span className="badge">{book.purpose === 'reading' ? 'Reading' : book.level}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <footer className="library-footer">
        <Link to="/about/safeguarding">Child safeguarding</Link>
      </footer>
    </div>
  );
}
