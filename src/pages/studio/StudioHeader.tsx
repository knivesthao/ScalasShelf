import { Link, useNavigate } from 'react-router-dom';
import { canReview, isAdmin, signOut, type StaffUser } from '@/lib/auth';

// Top of every Studio page for signed-in staff: who you are, where you can go, sign out.

export function StudioHeader({ title, user }: { title: string; user: StaffUser | null }) {
  const navigate = useNavigate();
  return (
    <header className="library-header studio-header">
      <h1>{title}</h1>
      <nav className="studio-nav" aria-label="Studio">
        <Link to="/studio">My books</Link>
        {canReview(user) && <Link to="/studio/review">Review</Link>}
        {isAdmin(user) && <Link to="/studio/staff">Staff</Link>}
        <Link to="/">Library</Link>
        {user && (
          <>
            <span className="studio-user" title={user.email}>{user.name || user.email} · {user.role}</span>
            <button className="link-btn" onClick={() => signOut().finally(() => navigate('/sign-in'))}>Sign out</button>
          </>
        )}
      </nav>
    </header>
  );
}

/** Shown when the API says the visitor isn't signed in. */
export function SignInPrompt({ next = '/studio', onTryAsGuest }: { next?: string; onTryAsGuest?: () => void }) {
  return (
    <div className="empty">
      <p>Staff sign in to write and send books for review.</p>
      <Link className="buy-btn" to={`/sign-in?next=${encodeURIComponent(next)}`}>Staff sign-in</Link>
      {onTryAsGuest && (
        <>
          <p className="hint">Just looking? Try the Studio with a demo book. Your drafts stay on this device.</p>
          <button className="ghost-btn" onClick={onTryAsGuest}>Try the Studio as a guest</button>
        </>
      )}
    </div>
  );
}
