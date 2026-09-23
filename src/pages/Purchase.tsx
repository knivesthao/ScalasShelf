import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface Content {
  id: string;
  title: string;
  creator_name: string;
  cover_image_url: string;
  price_kip: number;
}

const WHATSAPP_NUMBER = '+8562055550000';
const PAYMENT_INSTRUCTIONS_LAO =
  'ສົ່ງຫຼັກຖານການໂອນເງິນມາໃສ່ WhatsApp ພ້ອມລະບຸເບີໂທລະສັບຂອງທ່ານ';
const PAYMENT_INSTRUCTIONS_EN =
  'Send payment confirmation to WhatsApp with your phone number. We verify and credit your account within 24 hours.';

export function Purchase() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [book, setBook] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const redirectTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  useEffect(() => {
    async function fetchBook() {
      if (!id) return;
      const { data, error: fetchError } = await supabase
        .from('content')
        .select('id, title, creator_name, cover_image_url, price_kip')
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('Failed to load book:', fetchError.message);
      } else if (data) {
        setBook(data);
      }
      setLoading(false);
    }

    fetchBook();
  }, [id]);

  async function handleSubmit() {
    if (!user || !id) return;
    setSubmitting(true);
    setError('');

    if (import.meta.env.DEV) {
      // Dev: skip payment, purchase directly
      const { error: insertError } = await supabase.from('purchases').insert({
        user_id: user.id,
        content_id: id,
      });

      if (insertError) {
        setError('Failed to record purchase. Please try again.');
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
      redirectTimer.current = setTimeout(() => navigate('/my-library'), 2000);
      return;
    }

    // Create pending payment record
    const { error: rpcError } = await supabase.rpc('create_pending_payment', {
      p_content_id: id,
    });

    if (rpcError) {
      setError('Failed to submit payment. Please try again.');
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="purchase">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="purchase">
        <div className="empty"><p>Book not found.</p></div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="purchase">
        <div className="purchase-card success">
          <div className="success-icon">&#10003;</div>
          <h1>Payment Submitted</h1>
          <p>
            We'll verify your payment and credit your account within 24 hours.
            Check My Library once confirmed.
          </p>
          <button className="buy-btn" onClick={() => navigate('/my-library')}>
            Go to My Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="purchase">
      <button className="back-btn" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div className="purchase-card">
        <div className="purchase-header">
          <img
            src={book.cover_image_url || '/mock/cover-placeholder.svg'}
            alt={book.title}
          />
          <div>
            <h1>{book.title}</h1>
            <p className="creator">by {book.creator_name}</p>
          </div>
        </div>

        <div className="payment-section">
          <div className="price-display">
            <span className="price-label">Amount to pay</span>
            <span className="price-value">
              {book.price_kip.toLocaleString()} kip
            </span>
          </div>

          <div className="qr-section">
            <img
              src="/mock/qr-placeholder.png"
              alt="QR Code for payment"
              className="qr-code"
            />
            <p className="qr-hint">Scan with your banking app</p>
          </div>

          <div className="instructions">
            <h3>Instructions</h3>
            <ol>
              <li>Open your banking app (BCEL One, LDB Mobile, etc.)</li>
              <li>Scan the QR code above or enter our account number</li>
              <li>Send {book.price_kip.toLocaleString()} kip</li>
              <li>
                Take a screenshot of the payment confirmation
              </li>
              <li>
                Send the screenshot to WhatsApp:{' '}
                <strong>{WHATSAPP_NUMBER}</strong>
              </li>
              <li>Include your phone number in the message</li>
            </ol>
          </div>

          <div className="instructions-lao">
            <p>{PAYMENT_INSTRUCTIONS_LAO}</p>
          </div>

          {error && <p className="error-message">{error}</p>}

          <div className="payment-actions">
            <button
              className="buy-btn"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : "I've Paid"}
            </button>
            <p className="hint">
              {PAYMENT_INSTRUCTIONS_EN}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
