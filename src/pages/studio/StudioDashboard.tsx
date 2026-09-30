import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '@/lib/api';
import { currentUser, type StaffUser } from '@/lib/auth';
import { FEATURES } from '@/lib/features';
import { cloudActive, isGuest, moveDeviceDraftsToAccount, setGuest, studioStore, type NewProject } from '@/lib/studioStore';
import type { Level } from '@/lib/format';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Toast } from '@/components/Toast';
import { NewBookDialog } from './NewBookDialog';
import { SignInPrompt, StudioHeader } from './StudioHeader';

interface ProjectCard {
  id: string;
  type: string;
  title: string;
  level: Level;
  purpose?: 'learning' | 'reading';
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
  const [deleting, setDeleting] = useState<ProjectCard | null>(null);
  const [user, setUser] = useState<StaffUser | null>(null);
  const [movedCount, setMovedCount] = useState(0);

  async function load() {
    setLoading(true);
    if (cloudActive()) {
      const me = await currentUser().catch(() => null);
      setUser(me);
      // Signed in: bring over anything written here as a guest, then clear it from the device.
      if (me) setMovedCount(await moveDeviceDraftsToAccount().catch(() => 0));
    }
    studioStore.list()
      .then((list) => { setProjects(list); setSignedOut(false); })
      .catch((e: Error) => (e instanceof ApiError && e.status === 401 ? setSignedOut(true) : setError(e.message)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { void load(); }, []);

  function tryAsGuest() {
    setGuest(true);
    void load();
  }

  async function deleteProject(p: ProjectCard) {
    await studioStore.remove(p.id);
    setProjects((list) => list.filter((x) => x.id !== p.id));
    setDeleting(null);
  }

  async function createProject(input: NewProject) {
    const project = await studioStore.create(input);
    navigate(`/studio/${project.type}/${project.id}`);
  }

  if (loading) return <div className="loading">Loading...</div>;
  if (signedOut) return <SignInPrompt onTryAsGuest={tryAsGuest} />;

  return (
    <div className="studio">
      <StudioHeader title="Creator Studio" user={user} />
      {error && <p className="studio-error" role="alert">{error}</p>}
      {movedCount > 0 && (
        <Toast onDone={() => setMovedCount(0)}>
          Moved {movedCount} {movedCount === 1 ? 'draft' : 'drafts'} from this device into your account.
        </Toast>
      )}
      {!cloudActive() && (
        // Collapsed to one line; tap to read the whole note.
        <details className="guest-note">
          <summary>{isGuest() ? 'You’re trying the Studio as a guest' : 'Drafts are saved on this device'}</summary>
          <p>
            Write your story and build the quiz. Drafts are saved on this device.
            {!FEATURES.rendering && ' Illustrations are switched off for now.'}
            {isGuest() && FEATURES.cloudStudio && <> Staff <Link to="/sign-in?next=%2Fstudio">sign in</Link> to send books for review.</>}
          </p>
        </details>
      )}

      <div className="studio-actions">
        <button className="buy-btn" onClick={() => setCreating(true)}>+ New</button>
      </div>
      {deleting && (
        <ConfirmDialog
          title="Delete this draft?"
          message={`“${deleting.title}” and all its scenes will be deleted. This can’t be undone.`}
          confirmLabel="Delete draft"
          danger
          onConfirm={() => deleteProject(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
      {creating && <NewBookDialog canUseAi={cloudActive()} onCreate={createProject} onClose={() => setCreating(false)} />}

      {projects.length === 0 ? (
        <div className="empty"><p>No projects yet.</p></div>
      ) : (
        <div className="content-grid">
          {projects.map((p) => (
            <div key={p.id} className="content-card project-card">
              <Link to={`/studio/${p.type}/${p.id}`} className="card-body">
                <h2>{p.title}</h2>
                {p.purpose === 'reading' ? <span className="badge">reading</span> : <span className="badge">{p.level}</span>}
                <span className="badge">{p.status}</span>
                {p.review_status && REVIEW_BADGE[p.review_status] && <span className="badge">{REVIEW_BADGE[p.review_status]}</span>}
              </Link>
              {p.status === 'draft' && (
                <button className="icon-btn project-delete" onClick={() => setDeleting(p)} aria-label={`Delete ${p.title}`} title="Delete draft">
                  🗑
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
