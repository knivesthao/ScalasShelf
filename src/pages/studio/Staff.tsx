import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import { currentUser, type Role, type StaffUser } from '@/lib/auth';
import { listStaff, removeStaff, saveStaff } from '@/lib/review';
import { SignInPrompt, StudioHeader } from './StudioHeader';

// Admins decide who can sign in: creators write, reviewers approve books, admins do both
// and manage this list. Removing someone ends their access straight away.

const ROLE_HELP: Record<Role, string> = {
  creator: 'Writes books and sends them for review',
  reviewer: 'Checks books and publishes them',
  admin: 'Everything, plus this staff list',
};

export function StaffAdmin() {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [staff, setStaff] = useState<StaffUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [form, setForm] = useState<{ email: string; name: string; role: Role }>({ email: '', name: '', role: 'creator' });

  const fail = (e: Error) => (e instanceof ApiError && e.status === 401 ? setSignedOut(true) : setError(e.message));
  const reload = () => listStaff().then(setStaff).catch(fail);

  useEffect(() => {
    currentUser().then(setUser).catch(() => {});
    void reload();
  }, []);

  if (signedOut) return <SignInPrompt next="/studio/staff" />;

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
    if (!window.confirm(`Remove ${member.email}? They'll be signed out straight away.`)) return;
    setError(null);
    await removeStaff(member.email).then(reload).catch(fail);
  }

  return (
    <div className="studio">
      <StudioHeader title="Staff" user={user} />
      {error && <p className="studio-error" role="alert">{error}</p>}

      <form className="new-project" onSubmit={add}>
        <h2>Add someone</h2>
        <label>
          Email
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label>
          Name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label>
          Role
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {(Object.keys(ROLE_HELP) as Role[]).map((r) => <option key={r} value={r}>{r}: {ROLE_HELP[r]}</option>)}
          </select>
        </label>
        <div className="new-project-actions">
          <button type="submit" className="buy-btn" disabled={!form.email.trim()}>Add</button>
        </div>
      </form>

      {!staff && !error && <div className="loading">Loading...</div>}
      {staff && (
        <table className="staff-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th /></tr></thead>
          <tbody>
            {staff.map((m) => (
              <tr key={m.email}>
                <td>{m.name}</td>
                <td>{m.email}</td>
                <td>
                  <select aria-label={`Role for ${m.email}`} value={m.role} disabled={m.email === user?.email}
                    onChange={(e) => changeRole(m, e.target.value as Role)}>
                    {(Object.keys(ROLE_HELP) as Role[]).map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td>
                  {m.email !== user?.email && <button className="link-btn" onClick={() => remove(m)}>Remove</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
