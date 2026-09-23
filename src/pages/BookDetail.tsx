import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface Content {
  id: string;
  title: string;
  creator_name: string;
  language: 'lao' | 'english';
  reading_level: string;
  cover_image_url: string;
  price_kip: number;
  description: string;
}

export function BookDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    async function fetchBook() {
      if (!id) return;
      const { data, error } = await supabase
        .from('content')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Failed to load book:', error.message);
      } else {
        setBook(data);
      }
      setLoading(false);
    }

    fetchBook();
  }, [id]);

  async function handleBuy() {
    if (!user) {
      setPurchaseError('Please log in to purchase books.');
      return;
    }

    if (!book || !id) return;
    setPurchasing(true);
    setPurchaseError('');

    // In dev mode, skip payment and purchase directly
    if (import.meta.env.DEV) {
      const { error } = await supabase.from('purchases').insert({
        user_id: user.id,
        content_id: id,
      });

      if (error) {
        setPurchaseError('Purchase failed. Please try again.');
      } else {
        navigate('/my-library');
        return;
      }
    } else {
      // Real flow: record as pending payment
      const { error } = await supabase.from('payments').insert({
        user_id: user.id,
        content_id: id,
        amount_kip: book.price_kip,
        status: 'pending',
      });

      if (error) {
        setPurchaseError('Payment failed. Please try again.');
      } else {
        navigate(`/purchase/${id}`);
        return;
      }
    }

    setPurchasing(false);
  }

  if (loading) {
    return <div className="book-detail"><div className="loading">Loading...</div></div>;
  }

  if (!book) {
    return (
      <div className="book-detail">
        <div className="empty"><p>Book not found.</p></div>
      </div>
    );
  }

  return (
    <div className="book-detail">
      <button className="back-btn" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div className="book-hero">
        <img src={book.cover_image_url || '/mock/cover-placeholder.svg'} alt={book.title} />
        <div className="book-info">
          <h1>{book.title}</h1>
          <p className="creator">by {book.creator_name}</p>
          <div className="tags">
            <span className="badge">{book.language}</span>
            <span className="badge">{book.reading_level}</span>
          </div>
          <p className="description">{book.description}</p>
          <p className="price">{book.price_kip.toLocaleString()} kip</p>
          {purchaseError && <p className="error-message">{purchaseError}</p>}
          <button
            className="buy-btn"
            onClick={handleBuy}
            disabled={purchasing}
          >
            {purchasing ? 'Processing...' : 'Buy'}
          </button>
        </div>
      </div>
    </div>
  );
}
