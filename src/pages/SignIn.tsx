import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { redeemSignInLink, requestSignInLink } from '@/lib/auth';
import { setGuest } from '@/lib/studioStore';

// Staff sign-in. With ?token=… (from the emailed link) it signs straight in; otherwise it
// asks for an email and sends the link. Readers never need this page.

const safeNext = (value: string | null) => (value && /^\/studio(\/[\w/-]*)?$/.test(value) ? value : '/studio');

export function SignIn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const next = safeNext(params.get('next'));
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'form' | 'sending' | 'sent' | 'verifying'>(token ? 'verifying' : 'form');
  const [error, setError] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const redeemed = useRef(false);

  useEffect(() => {
    if (!token || redeemed.current) return;
    redeemed.current = true; // links work once; don't redeem twice under StrictMode
    redeemSignInLink(token)
      .then(() => { setGuest(false); navigate(next, { replace: true }); })
      .catch((e: Error) => { setError(e.message); setState('form'); });
  }, [token, next, navigate]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setState('sending');
    try {
      const res = await requestSignInLink(email.trim(), next);
      setDevLink(res.devLink ?? null);
      setState('sent');
    } catch (err) {
      setError((err as Error).message);
      setState('form');
    }
  }

  return (
    <div className="sign-in">
      <header className="library-header">
        <h1>Staff sign-in</h1>
        <Link to="/">← Library</Link>
      </header>

      {state === 'verifying' && <div className="loading">Signing you in…</div>}

      {state === 'sent' && (
        <div className="sign-in-card">
          <h2>Check your email</h2>
          <p>We sent a sign-in link to <strong>{email.trim().toLowerCase()}</strong>. It works once and expires in 15 minutes.</p>
          {devLink && (
            <p className="hint">Local development: <a href={devLink}>open the sign-in link</a></p>
          )}
          <button className="ghost-btn" onClick={() => setState('form')}>Use a different email</button>
        </div>
      )}

      {(state === 'form' || state === 'sending') && (
        <form className="sign-in-card" onSubmit={send}>
          <p>For Scala’s Shelf writers, reviewers and admins. Reading never needs an account.</p>
          <label>
            Email
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.org" />
          </label>
          {error && <p className="studio-error" role="alert">{error}</p>}
          <button type="submit" className="buy-btn" disabled={state === 'sending' || !email.trim()}>
            {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
          </button>
        </form>
      )}
    </div>
  );
}
