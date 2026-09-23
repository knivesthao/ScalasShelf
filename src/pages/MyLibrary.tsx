import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { getDownloadedScenes, removeContent } from '@/lib/idb';

interface Content {
  id: string;
  title: string;
  creator_name: string;
  language: string;
  reading_level: string;
  cover_image_url: string;
  price_kip: number;
}

export function MyLibrary() {
  const [books, setBooks] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [offline, setOffline] = useState(!navigator.onLine);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Track online/offline
  useEffect(() => {
    function goOffline() {
      setOffline(true);
    }
    function goOnline() {
      setOffline(false);
    }
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  // Fetch purchases
  useEffect(() => {
    async function fetchPurchases() {
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: purchases, error } = await supabase
        .from('purchases')
        .select('content_id')
        .eq('user_id', user.id);

      if (error || !purchases?.length) {
        setBooks([]);
        setLoading(false);
        return;
      }

      const contentIds = purchases.map((p) => p.content_id);
      const { data: content, error: contentError } = await supabase
        .from('content')
        .select('*')
        .in('id', contentIds);

      if (!contentError) {
        setBooks(content || []);
      }

      // Check which content is downloaded (parallel)
      const results = await Promise.all(
        contentIds.map((id) =>
          getDownloadedScenes(id).then(
            (scenes) => ({ id, hasScenes: scenes.length > 0 }),
            () => ({ id, hasScenes: false })
          )
        )
      );
      const downloaded = new Set<string>();
      for (const r of results) {
        if (r.hasScenes) downloaded.add(r.id);
      }
      setDownloadedIds(downloaded);

      setLoading(false);
    }

    fetchPurchases();
  }, [user]);

  async function handleRemove(id: string, title: string) {
    if (!confirm(`Remove downloaded content for "${title}"?`)) return;
    await removeContent(id);
    setDownloadedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="my-library">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="my-library">
      {offline && (
        <div className="offline-banner" role="alert">
          You are offline. Downloaded books are still available.
        </div>
      )}

      <header className="library-header">
        <h1>My Library</h1>
        <Link to="/">← Browse Library</Link>
      </header>

      {!user ? (
        <div className="empty">
          <p>Log in to see your purchased books.</p>
        </div>
      ) : books.length === 0 ? (
        <div className="empty">
          <p>No books purchased yet. Browse the library!</p>
          <Link to="/" className="browse-link">
            Browse books
          </Link>
        </div>
      ) : (
        <div className="content-grid" role="list">
          {books.map((book) => {
            const isDownloaded = downloadedIds.has(book.id);

            return (
              <div key={book.id} className="content-card my-book" role="listitem">
                <div
                  className="card-tap-area"
                  onClick={() => navigate(`/read/${book.id}`)}
                >
                  <div className="card-img-wrapper">
                    <img
                      src={book.cover_image_url || '/mock/cover-placeholder.svg'}
                      alt={book.title}
                      loading="lazy"
                    />
                    <span
                      className={`download-badge ${
                        isDownloaded ? 'downloaded' : ''
                      }`}
                      title={isDownloaded ? 'Downloaded' : 'Not downloaded'}
                    >
                      {isDownloaded ? '✓' : '☁'}
                    </span>
                  </div>
                  <div className="card-body">
                    <h2>{book.title}</h2>
                    <span className="badge">{book.language}</span>
                    <span className="badge">{book.reading_level}</span>
                  </div>
                </div>
                {isDownloaded && (
                  <button
                    className="remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(book.id, book.title);
                    }}
                    aria-label={`Remove ${book.title} from device`}
                  >
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
