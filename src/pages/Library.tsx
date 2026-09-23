import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface Content {
  id: string;
  title: string;
  creator_name: string;
  language: 'lao' | 'english';
  reading_level: 'beginner' | 'intermediate' | 'advanced';
  cover_image_url: string;
  price_kip: number;
  description: string;
}

export function Library() {
  const [content, setContent] = useState<Content[]>([]);
  const [search, setSearch] = useState('');
  const [language, setLanguage] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    async function fetchContent() {
      setLoading(true);
      let query = supabase.from('content').select('*');

      if (language !== 'all') {
        query = query.eq('language', language);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Failed to load catalog:', error.message);
      } else {
        setContent(data || []);
      }
      setLoading(false);
    }

    fetchContent();
  }, [language]);

  const filtered = content.filter((item) =>
    item.title.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="library">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="library">
      <header className="library-header">
        <h1>Textweaver</h1>
        <nav>
          <Link to="/my-library">My Library</Link>
          {user && <span className="user-phone">{user.phone}</span>}
        </nav>
      </header>

      <div className="filters">
        <input
          type="text"
          placeholder="Search books..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
          aria-label="Search books"
        />
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          aria-label="Filter by language"
        >
          <option value="all">All Languages</option>
          <option value="lao">ລາວ</option>
          <option value="english">English</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <p>No books found.</p>
        </div>
      ) : (
        <div className="content-grid" role="list">
          {filtered.map((item) => (
            <Link
              to={`/book/${item.id}`}
              key={item.id}
              className="content-card"
              role="listitem"
            >
              <img
                src={item.cover_image_url || '/mock/cover-placeholder.svg'}
                alt={item.title}
                loading="lazy"
              />
              <div className="card-body">
                <h2>{item.title}</h2>
                <span className="badge">{item.language}</span>
                <span className="badge">{item.reading_level}</span>
                <p className="price">{item.price_kip.toLocaleString()} kip</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
