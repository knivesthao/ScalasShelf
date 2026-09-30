import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ApiError } from '@/lib/api';
import { ROLE_LABEL, currentUser, isAdmin, type Role, type StaffUser } from '@/lib/auth';
import {
  TASK_LABEL, adminBook, adminBooks, adminOverview, count, hours, money, seconds,
  type AdminBook, type AdminBookRow, type Overview, type TaskUsage,
} from '@/lib/admin';
import { listStaff, removeStaff, saveStaff } from '@/lib/review';
import { SignInPrompt, StudioHeader } from './StudioHeader';

// Admins only (Studio → profile → Admin): what making books costs and how long it takes,
// each book's cost, and who can use the Studio.

type AdminTab = 'overview' | 'books' | 'users';
const TABS: { id: AdminTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'books', label: 'Books' },
  { id: 'users', label: 'Users' },
];

const ROLE_HELP: Record<Role, string> = {
  creator: 'Writes books and sends them for review',
  reviewer: 'Also approves books for Scala’s Shelf',
  admin: 'Everything, plus this admin view',
};

const PERIODS = [
  { id: '', label: 'All time' },
  { id: '30', label: 'Last 30 days' },
  { id: '7', label: 'Last 7 days' },
];

export function AdminPage() {
  const [params, setParams] = useSearchParams();
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  // A book's page (/studio/admin/books/:id) belongs to the Books tab.
  const tab: AdminTab = id ? 'books' : (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'overview');
  const [user, setUser] = useState<StaffUser | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'signed-out' | 'forbidden'>('loading');

  useEffect(() => {
    currentUser()
      .then((me) => { setUser(me); setState(!me ? 'signed-out' : isAdmin(me) ? 'ok' : 'forbidden'); })
      .catch(() => setState('signed-out'));
  }, []);

  if (state === 'loading') return <div className="loading">Loading...</div>;
  if (state === 'signed-out') return <SignInPrompt next="/studio/admin" />;
  if (state === 'forbidden') {
    return <div className="studio"><StudioHeader title="Admin" user={user} /><p className="studio-error">Only admins can open this page.</p></div>;
  }

  return (
    <div className="studio admin">
      <StudioHeader title="Admin" user={user} />
      <div className="studio-tabs" role="tablist" aria-label="Admin">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'is-active' : ''}
            onClick={() => (id ? navigate(`/studio/admin${t.id === 'overview' ? '' : `?tab=${t.id}`}`) : setParams(t.id === 'overview' ? {} : { tab: t.id }))}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'overview' && <OverviewTab />}
      {tab === 'books' && <BooksTab />}
      {tab === 'users' && <UsersTab me={user} />}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

function TaskTable({ rows }: { rows: TaskUsage[] }) {
  if (!rows.length) return <p className="hint">Scala hasn’t been used yet.</p>;
  return (
    <div className="table-scroll">
      <table className="staff-table admin-table">
        <thead><tr><th>Task</th><th>Calls</th><th>Tokens in</th><th>Tokens out</th><th>Time</th><th>Est. cost</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.task}-${r.model}`}>
              <td>{TASK_LABEL[r.task] ?? r.task}{r.failed > 0 && <span className="hint"> · {r.failed} failed</span>}</td>
              <td>{count(r.calls)}</td>
              <td>{count(r.input_tokens)}</td>
              <td>{count(r.output_tokens)}</td>
              <td>{seconds(r.ms / 1000)}</td>
              <td>{money(r.estimated_cost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OverviewTab() {
  const [period, setPeriod] = useState('');
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    const since = period ? new Date(Date.now() - Number(period) * 24 * 60 * 60 * 1000).toISOString() : undefined;
    adminOverview(since).then(setData).catch((e: Error) => setError(e.message));
  }, [period]);

  return (
    <div className="studio-pane">
      <div className="admin-toolbar">
        <select aria-label="Period" value={period} onChange={(e) => setPeriod(e.target.value)}>
          {PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>
      {error && <p className="studio-error" role="alert">{error}</p>}
      {!data && !error && <div className="loading">Loading...</div>}
      {data && (
        <>
          <section className="studio-section">
            <h2>Making a book</h2>
            <div className="stat-grid">
              <Stat label="Average Scala cost per book" value={data.per_book.books_with_ai ? money(data.per_book.avg_estimated_cost) : '—'} hint={`${data.per_book.books_with_ai} books used Scala`} />
              <Stat label="Average Scala time per book" value={seconds(data.per_book.avg_ai_seconds)} />
              <Stat label="First draft to sent for review" value={hours(data.per_book.avg_hours_to_submit)} hint="Average, all time" />
              <Stat label="Waiting for a moderator" value={hours(data.per_book.avg_hours_in_review)} hint="Average, all time" />
            </div>
          </section>

          <section className="studio-section">
            <h2>Scala (AI)</h2>
            <div className="stat-grid">
              <Stat label="Estimated cost" value={money(data.ai.estimated_cost)} />
              <Stat label="Calls" value={count(data.ai.calls)} hint={data.ai.failed ? `${data.ai.failed} failed` : undefined} />
              <Stat label="Tokens" value={count(data.ai.input_tokens + data.ai.output_tokens)} hint={`${count(data.ai.input_tokens)} in · ${count(data.ai.output_tokens)} out`} />
              <Stat label="Time working" value={seconds(data.ai.ms / 1000)} />
            </div>
            <TaskTable rows={data.ai.by_task} />
            <p className="hint">Costs are estimates from token counts and the prices in api/src/services/admin.ts. Workers AI’s free daily allowance can make real spend lower.</p>
          </section>

          <section className="studio-section">
            <h2>Books and reading</h2>
            <div className="stat-grid">
              <Stat label="On Scala’s Shelf" value={count(data.books.published)} />
              <Stat label="Waiting for review" value={count(data.books.in_review)} />
              <Stat label="Drafts" value={count(data.books.drafts)} />
              <Stat label="Readers (devices)" value={count(data.reading.readers)} hint={`${count(data.reading.opens)} opens · ${count(data.reading.finishes)} finished`} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

const STATUS_LABEL = (b: { status: string; review_status: string }) =>
  b.status === 'published' ? 'On the shelf' : b.review_status === 'in_review' ? 'In review' : b.review_status === 'changes_requested' ? 'Changes asked' : 'Draft';

function BooksTab() {
  const { id } = useParams<{ id?: string }>();
  const [books, setBooks] = useState<AdminBookRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { adminBooks().then(setBooks).catch((e: Error) => setError(e.message)); }, []);
  if (id) return <BookDetail id={id} />;

  return (
    <div className="studio-pane">
      {error && <p className="studio-error" role="alert">{error}</p>}
      {!books && !error && <div className="loading">Loading...</div>}
      {books && books.length === 0 && <p className="hint">No books yet.</p>}
      {books && books.length > 0 && (
        <div className="admin-books">
          {books.map((b) => (
            <Link key={b.id} to={`/studio/admin/books/${b.id}`} className="content-card admin-book">
              <div className="card-body">
                <h2>{b.title}</h2>
                <span className="badge">{STATUS_LABEL(b)}</span>
                <span className="badge">{b.purpose === 'reading' ? 'Reading' : 'Learning'}</span>
                <p className="hint">{b.creator_id}</p>
                <dl className="admin-book-facts">
                  <div><dt>Scala cost</dt><dd>{b.ai_calls ? money(b.estimated_cost) : '—'}</dd></div>
                  <div><dt>Tokens</dt><dd>{count(b.input_tokens + b.output_tokens)}</dd></div>
                  <div><dt>Scala time</dt><dd>{b.ai_calls ? seconds(b.ai_seconds) : '—'}</dd></div>
                  <div><dt>Readers</dt><dd>{count(b.readers)}</dd></div>
                </dl>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

function BookDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const [data, setData] = useState<AdminBook | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { adminBook(id).then(setData).catch((e: Error) => setError(e.message)); }, [id]);

  return (
    <div className="studio-pane">
      <button className="back-btn" onClick={() => navigate('/studio/admin?tab=books')}>← All books</button>
      {error && <p className="studio-error" role="alert">{error}</p>}
      {!data && !error && <div className="loading">Loading...</div>}
      {data && (
        <>
          <section className="studio-section">
            <h2>{data.project.title}</h2>
            <p className="hint">
              {STATUS_LABEL(data.project)} · {data.project.purpose === 'reading' ? 'Reading book' : `Learning book, ${data.project.level}`} · {data.project.scenes} scenes · by {data.project.creator_id}
            </p>
            <div className="stat-grid">
              <Stat label="Scala cost" value={money(data.ai.estimated_cost)} />
              <Stat label="Scala time" value={seconds(data.ai.by_task.reduce((s, r) => s + r.ms, 0) / 1000)} />
              <Stat label="Readers" value={count(data.reading?.readers)} hint={data.reading ? `${count(data.reading.opens)} opens · ${count(data.reading.finishes)} finished` : 'Not on the shelf yet'} />
              <Stat label="Average quiz score" value={data.reading?.avg_quiz_score == null ? '—' : `${Math.round(data.reading.avg_quiz_score * 100)}%`} />
            </div>
          </section>
          <section className="studio-section">
            <h2>Timeline</h2>
            <ul className="admin-timeline">
              <li><span>First draft</span><span>{when(data.project.created_at)}</span></li>
              <li><span>Sent for review</span><span>{when(data.project.submitted_at)}</span></li>
              <li><span>Approved{data.project.reviewed_by ? ` by ${data.project.reviewed_by}` : ''}</span><span>{when(data.project.reviewed_at)}</span></li>
              <li><span>Last edited</span><span>{when(data.project.updated_at)}</span></li>
            </ul>
          </section>
          <section className="studio-section">
            <h2>Scala’s work on this book</h2>
            <TaskTable rows={data.ai.by_task} />
            {data.ai.calls.length > 0 && (
              <details className="package-preview">
                <summary>Latest {data.ai.calls.length} calls</summary>
                <div className="table-scroll">
                  <table className="staff-table admin-table">
                    <thead><tr><th>When</th><th>Task</th><th>Tokens</th><th>Time</th><th>By</th></tr></thead>
                    <tbody>
                      {data.ai.calls.map((c, i) => (
                        <tr key={i}>
                          <td>{when(c.created_at)}</td>
                          <td>{TASK_LABEL[c.task] ?? c.task}{!c.ok && ' (failed)'}</td>
                          <td>{c.input_tokens == null ? '—' : count((c.input_tokens ?? 0) + (c.output_tokens ?? 0))}</td>
                          <td>{seconds(c.ms / 1000)}</td>
                          <td>{c.user_id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function UsersTab({ me }: { me: StaffUser | null }) {
  const [staff, setStaff] = useState<StaffUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<StaffUser | null>(null);
  const [form, setForm] = useState<{ email: string; name: string; role: Role }>({ email: '', name: '', role: 'creator' });

  const fail = (e: Error) => setError(e instanceof ApiError && e.status === 401 ? 'Sign in again to manage users.' : e.message);
  const reload = () => listStaff().then(setStaff).catch(fail);
  useEffect(() => { void reload(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await saveStaff({ ...form, email: form.email.trim() });
      setForm({ email: '', name: '', role: 'creator' });
      await reload();
    } catch (err) {
      fail(err as Error);
    }
  }

  async function changeRole(member: StaffUser, role: Role) {
    setError(null);
    await saveStaff({ ...member, role }).then(reload).catch(fail);
  }

  async function remove(member: StaffUser) {
    await removeStaff(member.email);
    setRemoving(null);
    await reload();
  }

  return (
    <div className="studio-pane">
      {error && <p className="studio-error" role="alert">{error}</p>}

      <section className="studio-section">
        <h2>Users</h2>
        <p className="hint">Creators write books. Moderators also approve books for Scala’s Shelf. Admins can do everything, including this page.</p>
        {!staff && !error && <div className="loading">Loading...</div>}
        {staff && (
          <ul className="user-list">
            {staff.map((m) => (
              <li key={m.email} className="user-row">
                <div className="user-who">
                  <strong>{m.name || m.email}</strong>
                  {m.name && <span className="hint">{m.email}</span>}
                </div>
                <select aria-label={`Role for ${m.email}`} value={m.role} disabled={m.email === me?.email}
                  onChange={(e) => changeRole(m, e.target.value as Role)}>
                  {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
                {m.email === me?.email ? (
                  <span className="hint">You</span>
                ) : (
                  <button className="icon-btn" onClick={() => setRemoving(m)} aria-label={`Delete ${m.email}`} title="Delete user">🗑</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form className="studio-section new-project" onSubmit={add}>
        <h2>Add a user</h2>
        <label className="inspector-field">
          Email
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="inspector-field">
          Name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="inspector-field">
          Role
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}: {ROLE_HELP[r]}</option>)}
          </select>
        </label>
        <div className="new-project-actions">
          <button type="submit" className="buy-btn" disabled={!form.email.trim()}>Add user</button>
        </div>
      </form>

      {removing && (
        <ConfirmDialog
          title="Delete this user?"
          message={`${removing.name || removing.email} will be signed out straight away and can’t use the Studio any more. Their books stay.`}
          confirmLabel="Delete user"
          danger
          onConfirm={() => remove(removing)}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
