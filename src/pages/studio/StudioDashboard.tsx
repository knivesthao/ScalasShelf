import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '@/lib/api';
import { currentUser, type StaffUser } from '@/lib/auth';
import { FEATURES } from '@/lib/features';
import { cloudActive, isGuest, setGuest, studioStore } from '@/lib/studioStore';
import { LEVELS, type Level } from '@/lib/format';
import { SignInPrompt, StudioHeader } from './StudioHeader';

interface ProjectCard {
  id: string;
  type: string;
  title: string;
  level: Level;
  status: string;
  review_status?: string;
}

const REVIEW_BADGE: Record<string, string> = { in_review: 'in review', changes_requested: 'changes requested' };

export function StudioDashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState<Level>('A1');
  const [user, setUser] = useState<StaffUser | null>(null);

  function load() {
    setLoading(true);
    if (cloudActive()) currentUser().then(setUser).catch(() => {});
    studioStore.list()
      .then((list) => { setProjects(list); setSignedOut(false); })
      .catch((e: Error) => (e instanceof ApiError && e.status === 401 ? setSignedOut(true) : setError(e.message)))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function tryAsGuest() {
    setGuest(true);
    load();
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const project = await studioStore.create({ title: title.trim(), level });
      navigate(`/studio/${project.type}/${project.id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (loading) return <div className="loading">Loading...</div>;
  if (signedOut) return <SignInPrompt onTryAsGuest={tryAsGuest} />;

  return (
    <div className="studio">
      <StudioHeader title="Creator Studio" user={user} />
      {error && <p className="studio-error" role="alert">{error}</p>}
      {!cloudActive() && (
        <p className="studio-note">
          {isGuest() ? 'You’re trying the Studio as a guest. ' : ''}
          Write your story and build the quiz. Drafts are saved on this device.
          {!FEATURES.rendering && ' Illustrations are switched off for now.'}
          {isGuest() && FEATURES.cloudStudio && <> Staff <Link to="/sign-in?next=%2Fstudio">sign in</Link> to send books for review.</>}
        </p>
      )}

      {creating ? (
        <form className="new-project" onSubmit={createProject}>
          <h2>New English comic</h2>
          <label>
            Title
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Noy and the Buffalo"
            />
          </label>
          <label>
            Level
            <select value={level} onChange={(e) => setLevel(e.target.value as Level)}>
              {LEVELS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
          <div className="new-project-actions">
            <button type="submit" className="buy-btn" disabled={!title.trim()}>Create</button>
            <button type="button" className="ghost-btn" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="studio-actions">
          <button className="buy-btn" onClick={() => setCreating(true)}>+ New Comic</button>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="empty"><p>No projects yet.</p></div>
      ) : (
        <div className="content-grid">
          {projects.map((p) => (
            <Link to={`/studio/${p.type}/${p.id}`} key={p.id} className="content-card">
              <div className="card-body">
                <h2>{p.title}</h2>
                <span className="badge">{p.level}</span>
                <span className="badge">{p.status}</span>
                {p.review_status && REVIEW_BADGE[p.review_status] && <span className="badge">{REVIEW_BADGE[p.review_status]}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
