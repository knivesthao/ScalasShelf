import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ROLE_LABEL, canReview, isAdmin, signOut, type StaffUser } from '@/lib/auth';

// Top of every Studio page: the page title and a profile menu on top, then the Studio
// sections. The profile menu shows who you are, the way back to Scala’s Shelf and
// Sign out (Sign in for guests).

export function StudioHeader({ title, user }: { title: string; user: StaffUser | null }) {
  return (
    <header className="library-header studio-header">
      <div className="studio-header-top">
        <h1>{title}</h1>
        <ProfileMenu user={user} />
      </div>
      <nav className="studio-nav" aria-label="Studio">
        <NavLink to="/studio" end>My desk</NavLink>
        {canReview(user) && <NavLink to="/studio/review">Review</NavLink>}
      </nav>
    </header>
  );
}

function initials(user: StaffUser): string {
  const words = (user.name || user.email).split(/[\s@.]+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

function ProfileMenu({ user }: { user: StaffUser | null }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="profile" ref={ref}>
      <button
        className="profile-btn"
        aria-label="Profile menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {user ? initials(user) : (
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7z" />
          </svg>
        )}
      </button>
      {open && (
        <div className="profile-menu" role="menu">
          <div className="profile-who">
            <strong>{user ? user.name || user.email : 'Guest'}</strong>
            {user ? <span>{user.email} · {ROLE_LABEL[user.role]}</span> : <span>Drafts stay on this device</span>}
          </div>
          {isAdmin(user) && <Link to="/studio/admin" role="menuitem" className="profile-item">Admin</Link>}
          <Link to="/" role="menuitem" className="profile-item">Back to Scala’s Shelf</Link>
          {user ? (
            <button
              role="menuitem"
              className="profile-item"
              onClick={() => signOut().finally(() => navigate('/sign-in'))}
            >
              Sign out
            </button>
          ) : (
            <Link to="/sign-in?next=%2Fstudio" role="menuitem" className="profile-item">Staff sign-in</Link>
          )}
        </div>
      )}
    </div>
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
