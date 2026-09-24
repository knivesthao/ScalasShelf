import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { bookBytes, formatBytes, loadBook, type Book } from '@/lib/books';
import { LEVELS } from '@/lib/format';
import { removeSavedBook, saveBookOffline } from '@/lib/offline';

export function BookDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    loadBook(id)
      .then(({ book: b, saved: s }) => { setBook(b); setSaved(s); })
      .catch(() => setError('This book isn’t on your phone, and there’s no internet connection.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function download() {
    if (!book) return;
    setError(null);
    setProgress(0);
    try {
      await saveBookOffline(book, (done, total) => setProgress(done / total));
      setSaved(true);
    } catch {
      setError('Download stopped. Try again when you have a connection; it will continue where it left off.');
    } finally {
      setProgress(null);
    }
  }

  async function remove() {
    if (!book) return;
    await removeSavedBook(book.id);
    setSaved(false);
  }

  if (loading) return <div className="book-detail"><div className="loading">Loading...</div></div>;
  if (!book) {
    return (
      <div className="book-detail">
        <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
        <div className="empty"><p>{error ?? 'Book not found.'}</p></div>
      </div>
    );
  }

  const { manifest, text } = book.package;
  const sceneCount = manifest.editions.lite.chunks.reduce((n, c) => n + c.scenes.length, 0);
  const bytes = bookBytes(book);
  const levelLabel = LEVELS.find((l) => l.id === book.level)?.label ?? book.level;

  return (
    <div className="book-detail">
      <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>

      <div className="book-hero">
        {book.cover_url ? <img src={book.cover_url} alt="" /> : <div className="cover-placeholder" aria-hidden>📖</div>}
        <div className="book-info">
          <h1>{book.title}</h1>
          <div className="tags">
            <span className="badge">{levelLabel}</span>
            <span className="badge">Free</span>
          </div>
          {book.description && <p className="description">{book.description}</p>}
          <p className="book-facts">
            {sceneCount} {sceneCount === 1 ? 'scene' : 'scenes'} · {text.vocab.length} new words
            {text.quiz.length > 0 && ` · ${text.quiz.length}-question check`}
            {bytes && ` · ${formatBytes(bytes)}`}
          </p>

          <div className="book-actions">
            <Link to={`/read/${book.id}`} className="buy-btn">Read</Link>
            {saved ? (
              <>
                <span className="saved-badge">✓ Saved on this phone</span>
                <button className="ghost-btn" onClick={remove}>Remove</button>
              </>
            ) : (
              <button className="ghost-btn" onClick={download} disabled={progress !== null}>
                {progress !== null ? `Downloading… ${Math.round(progress * 100)}%` : 'Download for offline'}
              </button>
            )}
          </div>
          {error && <p className="error-message" role="alert">{error}</p>}
        </div>
      </div>

      {text.vocab.length > 0 && (
        <section className="vocab-preview">
          <h2>Words in this story</h2>
          <ul>
            {text.vocab.map((v) => (
              <li key={v.id}><strong lang="en">{v.headword}</strong>{v.meaning && <span>: {v.meaning}</span>}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
