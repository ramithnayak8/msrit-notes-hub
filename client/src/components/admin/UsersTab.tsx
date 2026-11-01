'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminJson, send, type AdminUser } from '@/lib/client/admin';
import { useFlash } from './useFlash';

const ROLES: { id: AdminUser['role']; label: string; can: string }[] = [
  { id: 'user', label: 'Student', can: 'search, insights, AI answers' },
  { id: 'uploader', label: 'Uploader', can: 'also upload papers' },
  { id: 'moderator', label: 'Moderator', can: 'also this dashboard' },
];

/** Accounts and their roles. Role changes reach the person's session within 15 minutes. */
export function UsersTab({ me, onChange }: { me: string; onChange: () => void }) {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: AdminUser[]; total: number; pages: number } | null>(null);
  const { flash, run } = useFlash();

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ page: String(page), ...(query && { q: query }), ...(role && { role }) });
    setData(await adminJson(`/admin/users?${qs}`));
  }, [page, query, role]);
  useEffect(() => {
    void run(load);
  }, [load, run]);
  // Deleting the last row of the last page leaves an empty page: step back to the new last one.
  useEffect(() => {
    if (data && page > data.pages) setPage(data.pages);
  }, [data, page]);

  const after = async () => {
    await load();
    onChange();
  };
  const setUserRole = (u: AdminUser, next: AdminUser['role']) =>
    run(async () => (await adminJson(`/admin/users/${u.id}`, send('PATCH', { role: next })), await after()), `${u.email} is now ${ROLES.find((r) => r.id === next)!.label.toLowerCase()}`);
  const remove = (u: AdminUser) =>
    confirm(`Delete the account ${u.email}? They will be signed out everywhere. Papers they uploaded stay.`) &&
    run(async () => (await adminJson(`/admin/users/${u.id}`, send('DELETE')), await after()), `Deleted ${u.email}`);

  return (
    <div className="stack gap-16">
      {flash}
      <p className="small muted">{ROLES.map((r) => `${r.label}: ${r.can}`).join(' · ')}</p>
      <form
        className="row gap-10 wrap"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(q.trim());
        }}
      >
        <input className="input" style={{ maxWidth: 320 }} placeholder="Name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search accounts" />
        <select className="input" style={{ width: 'auto' }} value={role} onChange={(e) => (setRole(e.target.value), setPage(1))} aria-label="Filter by role">
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}s</option>)}
        </select>
        <button type="submit" className="btn btn-outline btn-sm">Search</button>
        {data && <span className="small muted">{data.total} account{data.total === 1 ? '' : 's'}</span>}
      </form>
      {!data ? (
        <p className="muted">Loading accounts…</p>
      ) : data.items.length === 0 ? (
        <div className="panel panel-pad muted">No accounts match.</div>
      ) : (
        <div className="panel table-wrap">
          <table className="table dash-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.name}
                    {u.id === me && <span className="xs muted"> (you)</span>}
                  </td>
                  <td className="small">
                    {u.email}
                    {!u.emailVerified && <div className="xs muted">not verified</div>}
                  </td>
                  <td>
                    <select className="input" style={{ width: 'auto' }} value={u.role} disabled={u.id === me} onChange={(e) => setUserRole(u, e.target.value as AdminUser['role'])} aria-label={`Role for ${u.email}`} title={u.id === me ? 'You cannot change your own role' : undefined}>
                      {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                  </td>
                  <td className="small muted nums">{new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
                  <td className="dash-cell-actions">
                    {u.id !== me && <button type="button" className="btn btn-quiet btn-sm dash-danger" onClick={() => remove(u)}>Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.pages > 1 && (
        <div className="row gap-10">
          <button type="button" className="btn btn-quiet btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="small muted nums">Page {page} of {data.pages}</span>
          <button type="button" className="btn btn-quiet btn-sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
