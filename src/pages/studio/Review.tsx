import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ComicView } from '@/components/ComicView';
import { ApiError } from '@/lib/api';
import { currentUser, type StaffUser } from '@/lib/auth';
import { approve, requestChanges, reviewItem, reviewQueue, type ReviewItem } from '@/lib/review';
import { SignInPrompt, StudioHeader } from './StudioHeader';

// Reviewers check every book before children can read it (safeguarding policy): the
// queue of submitted books, and one book shown exactly as the Reader will show it.

function useStaffPage<T>(load: () => Promise<T>, deps: unknown[]) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  useEffect(() => {
    currentUser().then(setUser).catch(() => {});
    load()
      .then(setData)
      .catch((e: Error) => (e instanceof ApiError && e.status === 401 ? setSignedOut(true) : setError(e.message)));
  }, deps);
  return { user, data, error, signedOut };
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export function ReviewQueue() {
  const { user, data, error, signedOut } = useStaffPage(reviewQueue, []);
  if (signedOut) return <SignInPrompt next="/studio/review" />;

  return (
    <div className="studio">
      <StudioHeader title="Review" user={user} />
      <p className="studio-note">
        Read each book the way a child will. Approve it into the library, or send it back with a note for the writer.
      </p>
      {error && <p className="studio-error" role="alert">{error}</p>}
      {!data && !error && <div className="loading">Loading...</div>}
      {data?.length === 0 && <div className="empty"><p>Nothing waiting for review.</p></div>}
      {data && data.length > 0 && (
        <div className="content-grid">
          {data.map((item) => (
            <Link to={`/studio/review/${item.id}`} key={item.id} className="content-card">
              <div className="card-body">
                <h2>{item.title}</h2>
                <span className="badge">{item.level}</span>
                {item.status === 'published' && <span className="badge">update</span>}
                <p className="hint">{item.creator_id} · sent {when(item.submitted_at)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReviewBook() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, data, error, signedOut } = useStaffPage<ReviewItem>(() => reviewItem(id), [id]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (signedOut) return <SignInPrompt next={`/studio/review/${id}`} />;

  async function act(run: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await run();
      navigate('/studio/review');
    } catch (e) {
      setActionError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="studio review-book">
      <StudioHeader title="Review" user={user} />
      {error && <p className="studio-error" role="alert">{error}</p>}
      {!data && !error && <div className="loading">Loading...</div>}
      {data && (
        <>
          <section className="studio-section">
            <h2>{data.project.title}</h2>
            <p>
              <span className="badge">{data.project.level}</span>{' '}
              <span className="hint">by {data.project.creator_id} · sent {when(data.project.submitted_at)}</span>
            </p>
            {data.project.description && <p>{data.project.description}</p>}
          </section>

          <div className="reader review-preview" aria-label="Book preview">
            <ComicView pkg={data.package} assets={data.package.manifest.editions.lite.assets} still={false} />
          </div>

          <section className="studio-section review-actions">
            <h2>Your decision</h2>
            <p className="hint">
              Check the pictures and words are right for children, the level fits, and the quiz answers are correct.
            </p>
            <button className="buy-btn" disabled={busy} onClick={() => act(() => approve(id))}>
              Approve and publish
            </button>
            <label className="inspector-field">
              Or send it back: what should the writer change?
              <textarea rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <button className="ghost-btn" disabled={busy || !note.trim()} onClick={() => act(() => requestChanges(id, note.trim()))}>
              Send back with note
            </button>
            {actionError && <p className="studio-error" role="alert">{actionError}</p>}
          </section>
        </>
      )}
    </div>
  );
}
