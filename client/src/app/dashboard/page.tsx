'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';

type Role = 'user' | 'uploader' | 'admin';
type User = { id: number; name: string; email: string; role: Role; created_at?: string };
type Note = {
  id: number;
  course_code: string;
  course_title: string;
  title: string;
  kind: string;
  pages: number;
  contributor: string;
  year: number;
  created_by: number | null;
};
type Course = { code: string; title: string };
type Draft = { course_code: string; title: string; kind: string; pages: string; year: string };

const KINDS = ['Handwritten', 'Summary', 'Cheat sheet', 'Solved', 'Typed', 'Slides'];
const RANK: Record<Role, number> = { user: 0, uploader: 1, admin: 2 };
const can = (u: User | null, role: Role) => !!u && RANK[u.role] >= RANK[role];

const PERMISSIONS: { label: string; role: Role | 'guest' }[] = [
  { label: 'Read notes', role: 'guest' },
  { label: 'Create notes', role: 'uploader' },
  { label: 'Edit own notes', role: 'uploader' },
  { label: 'Edit any note', role: 'admin' },
  { label: 'Delete notes', role: 'admin' },
  { label: 'Manage users and roles', role: 'admin' },
];

const DEMO = [
  { email: 'admin@msrit.edu', password: 'admin123', role: 'admin' },
  { email: 'uploader@msrit.edu', password: 'uploader123', role: 'uploader' },
  { email: 'student@msrit.edu', password: 'student123', role: 'user' },
];

const emptyDraft = (courses: Course[]): Draft => ({
  course_code: courses[0]?.code ?? '',
  title: '',
  kind: 'Handwritten',
  pages: '10',
  year: String(new Date().getFullYear()),
});

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filter, setFilter] = useState('');
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const say = (kind: 'ok' | 'err', text: string) => {
    setFlash({ kind, text });
    window.setTimeout(() => setFlash(null), 4000);
  };

  const refresh = useCallback(async () => {
    const [{ user: me }, list] = await Promise.all([
      call<{ user: User | null }>('/api/demo/auth/me'),
      call<{ notes: Note[]; courses: Course[] }>('/api/demo/notes'),
    ]);
    setUser(me);
    setNotes(list.notes);
    setCourses(list.courses);
    if (can(me, 'admin')) setUsers((await call<{ users: User[] }>('/api/demo/users')).users);
    else setUsers([]);
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh().catch((e) => say('err', e.message));
  }, [refresh]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      say('ok', success);
      await refresh();
      return true;
    } catch (e) {
      say('err', (e as Error).message);
      return false;
    }
  };

  const saveNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const body = JSON.stringify({ ...draft, pages: Number(draft.pages), year: Number(draft.year) });
    const ok = editingId
      ? await run(() => call(`/api/demo/notes/${editingId}`, { method: 'PATCH', body }), 'Note updated')
      : await run(() => call('/api/demo/notes', { method: 'POST', body }), 'Note created');
    if (ok) {
      setDraft(null);
      setEditingId(null);
    }
  };

  const startEdit = (n: Note) => {
    setEditingId(n.id);
    setDraft({ course_code: n.course_code, title: n.title, kind: n.kind, pages: String(n.pages), year: String(n.year) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeNote = (n: Note) => {
    if (window.confirm(`Delete "${n.title}"?`)) run(() => call(`/api/demo/notes/${n.id}`, { method: 'DELETE' }), 'Note deleted');
  };

  const logout = () => run(() => call('/api/demo/auth/logout', { method: 'POST' }), 'Signed out');

  const shown = notes.filter((n) =>
    `${n.title} ${n.course_code} ${n.course_title} ${n.kind} ${n.contributor}`.toLowerCase().includes(filter.toLowerCase()),
  );
  const canEdit = (n: Note) => can(user, 'admin') || (can(user, 'uploader') && n.created_by === user?.id);

  return (
    <main>
      <section className="page-head">
        <div className="shell">
          <p className="eyebrow">Dashboard</p>
          <h1>Notes, accounts and roles</h1>
          <p className="lead">
            Sign in with one of the three roles to see what each one is allowed to do. Every change here is written to the
            local SQLite database and checked on the server, not just hidden in the page. These demo accounts are
            separate from the main sign-in, which runs on the API server.
          </p>
        </div>
      </section>

      <div className="shell dash">
        {flash && (
          <p className={`dash-flash ${flash.kind}`} role="status">
            {flash.text}
          </p>
        )}

        {!loaded ? (
          <p className="dash-muted">Loading…</p>
        ) : user ? (
          <section className="dash-card dash-session">
            <div>
              <p className="dash-muted">Signed in as</p>
              <p className="dash-who">
                {user.name} <span className="dash-email">{user.email}</span>{' '}
                <span className={`dash-role role-${user.role}`}>{user.role}</span>
              </p>
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={logout}>
              Sign out
            </button>
          </section>
        ) : (
          <AuthForms onDone={refresh} say={say} />
        )}

        <section className="dash-card">
          <h2>What {user ? `the ${user.role} role` : 'a guest'} can do</h2>
          <ul className="dash-perms">
            {PERMISSIONS.map((p) => {
              const allowed = p.role === 'guest' || can(user, p.role);
              return (
                <li key={p.label} className={allowed ? 'yes' : 'no'}>
                  <span aria-hidden>{allowed ? '✓' : '✕'}</span> {p.label}
                  {p.role !== 'guest' && <span className="dash-muted"> · {p.role}</span>}
                </li>
              );
            })}
          </ul>
        </section>

        {can(user, 'uploader') && (
          <section className="dash-card">
            <div className="dash-row">
              <h2>{editingId ? `Edit note #${editingId}` : 'Add a note'}</h2>
              {!draft && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setDraft(emptyDraft(courses))}>
                  New note
                </button>
              )}
            </div>
            {draft && (
              <form className="dash-form" onSubmit={saveNote}>
                <label>
                  Title
                  <input required maxLength={120} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                </label>
                <label>
                  Course
                  <select value={draft.course_code} onChange={(e) => setDraft({ ...draft, course_code: e.target.value })}>
                    {courses.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} · {c.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Kind
                  <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
                    {KINDS.map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Pages
                  <input type="number" min={1} max={1000} required value={draft.pages} onChange={(e) => setDraft({ ...draft, pages: e.target.value })} />
                </label>
                <label>
                  Year
                  <input type="number" min={2000} max={2100} required value={draft.year} onChange={(e) => setDraft({ ...draft, year: e.target.value })} />
                </label>
                <div className="dash-actions">
                  <button type="submit" className="btn btn-primary btn-sm">
                    {editingId ? 'Save changes' : 'Create note'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-quiet btn-sm"
                    onClick={() => {
                      setDraft(null);
                      setEditingId(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </section>
        )}

        <section className="dash-card">
          <div className="dash-row">
            <h2>
              Notes <span className="dash-muted">({shown.length})</span>
            </h2>
            <input className="dash-filter" type="search" placeholder="Filter notes" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title</th>
                  <th>Course</th>
                  <th>Kind</th>
                  <th>Pages</th>
                  <th>Year</th>
                  <th>By</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {shown.map((n) => (
                  <tr key={n.id}>
                    <td className="dash-muted">{n.id}</td>
                    <td>{n.title}</td>
                    <td title={n.course_title}>{n.course_code}</td>
                    <td>{n.kind}</td>
                    <td>{n.pages}</td>
                    <td>{n.year}</td>
                    <td>{n.contributor}</td>
                    <td className="dash-cell-actions">
                      {canEdit(n) && (
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => startEdit(n)}>
                          Edit
                        </button>
                      )}
                      {can(user, 'admin') && (
                        <button type="button" className="btn btn-quiet btn-sm dash-danger" onClick={() => removeNote(n)}>
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {can(user, 'admin') && (
          <section className="dash-card">
            <h2>Users</h2>
            <div className="dash-table-wrap">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="dash-muted">{u.id}</td>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        {u.id === user?.id ? (
                          <span className={`dash-role role-${u.role}`}>{u.role} (you)</span>
                        ) : (
                          <select
                            value={u.role}
                            aria-label={`Role for ${u.name}`}
                            onChange={(e) =>
                              run(
                                () => call(`/api/demo/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ role: e.target.value }) }),
                                `${u.name} is now ${e.target.value}`,
                              )
                            }
                          >
                            <option value="user">user</option>
                            <option value="uploader">uploader</option>
                            <option value="admin">admin</option>
                          </select>
                        )}
                      </td>
                      <td className="dash-cell-actions">
                        {u.id !== user?.id && (
                          <button
                            type="button"
                            className="btn btn-quiet btn-sm dash-danger"
                            onClick={() =>
                              window.confirm(`Delete ${u.email}?`) &&
                              run(() => call(`/api/demo/users/${u.id}`, { method: 'DELETE' }), 'User deleted')
                            }
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function AuthForms({ onDone, say }: { onDone: () => Promise<void>; say: (k: 'ok' | 'err', t: string) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent, override?: { email: string; password: string }) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = override ?? (mode === 'login' ? { email: form.email, password: form.password } : form);
      await call(`/api/demo/auth/${override ? 'login' : mode}`, { method: 'POST', body: JSON.stringify(body) });
      say('ok', mode === 'register' && !override ? 'Account created. New accounts start as user.' : 'Signed in');
      await onDone();
    } catch (err) {
      say('err', (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="dash-card dash-auth">
      <div className="dash-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => setMode('login')}>
          Sign in
        </button>
        <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => setMode('register')}>
          Register
        </button>
      </div>
      <form className="dash-form" onSubmit={submit}>
        {mode === 'register' && (
          <label>
            Name
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
        )}
        <label>
          Email
          <input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={mode === 'register' ? 6 : undefined}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>
        <div className="dash-actions">
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </div>
      </form>
      <div className="dash-demo">
        <p className="dash-muted">Demo accounts, one per role:</p>
        {DEMO.map((d) => (
          <button key={d.email} type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={(e) => submit(e as unknown as FormEvent, d)}>
            Sign in as {d.role}
          </button>
        ))}
      </div>
    </section>
  );
}
