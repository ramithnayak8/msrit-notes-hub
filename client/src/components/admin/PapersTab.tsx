'use client';

import { useCallback, useEffect, useState } from 'react';
import { paperFileUrl } from '@/lib/api';
import { adminJson, send, type Paper } from '@/lib/client/admin';
import { useFlash } from './useFlash';

const STATUS: Record<Paper['status'], { label: string; tone: string }> = {
  queued: { label: 'Queued', tone: '' },
  processing: { label: 'Processing', tone: 'tag-accent' },
  ready: { label: 'Ready', tone: 'tag-positive' },
  needs_review: { label: 'Needs review', tone: 'tag-amber' },
  failed: { label: 'Failed', tone: 'tag-negative' },
};

/** Every paper with its processing status: reprocess one that failed, or remove one that shouldn't be here. */
export function PapersTab({ onChange }: { onChange: () => void }) {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Paper[]; total: number; pages: number } | null>(null);
  const { flash, run } = useFlash();

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ page: String(page), limit: '25', ...(status && { status }) });
    setData(await adminJson(`/documents?${qs}`));
  }, [page, status]);
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
  const reprocess = (p: Paper) => run(async () => (await adminJson(`/documents/${p._id}/reprocess`, send('POST')), await after()), `Queued "${p.title}" for processing again`);
  const remove = (p: Paper) =>
    confirm(`Delete "${p.title}" and its ${p.questionCount} questions from the archive? This cannot be undone.`) &&
    run(async () => (await adminJson(`/documents/${p._id}`, send('DELETE')), await after()), `Deleted "${p.title}"`);

  return (
    <div className="stack gap-16">
      {flash}
      <div className="row gap-10 wrap">
        <label className="row gap-10 small">
          <span className="label">Status</span>
          <select className="input" style={{ width: 'auto' }} value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))}>
            <option value="">All</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        {data && <span className="small muted">{data.total} paper{data.total === 1 ? '' : 's'}</span>}
      </div>
      {!data ? (
        <p className="muted">Loading papers…</p>
      ) : data.items.length === 0 ? (
        <div className="panel panel-pad muted">No papers with this status.</div>
      ) : (
        <div className="panel table-wrap">
          <table className="table dash-table">
            <thead>
              <tr>
                <th>Paper</th>
                <th>Course</th>
                <th>Status</th>
                <th className="num">Questions</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p._id}>
                  <td>
                    <a href={paperFileUrl(p._id)} target="_blank" rel="noopener noreferrer">{p.title}</a>
                    {p.error && <div className="xs" style={{ color: 'var(--negative)', marginTop: 4 }}>{p.error}</div>}
                    {p.fileStored === false && <div className="xs muted">PDF opens at its source link</div>}
                  </td>
                  <td className="small muted">{[p.courseCode, p.examType, p.year].filter(Boolean).join(' · ') || '–'}</td>
                  <td><span className={`tag ${STATUS[p.status].tone}`}>{STATUS[p.status].label}</span></td>
                  <td className="num">{p.questionCount}</td>
                  <td className="dash-cell-actions">
                    {p.fileStored !== false && (p.status === 'failed' || p.status === 'needs_review' || p.status === 'ready') && (
                      <button type="button" className="btn btn-quiet btn-sm" onClick={() => reprocess(p)}>Reprocess</button>
                    )}
                    <button type="button" className="btn btn-quiet btn-sm dash-danger" onClick={() => remove(p)}>Delete</button>
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
