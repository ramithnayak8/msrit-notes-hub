'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminJson, send, type Topic } from '@/lib/client/admin';
import { useFlash } from './useFlash';

/**
 * Topics the tagger proposed: approve them (one by one or in bulk), fix a
 * label, or merge a duplicate into an existing topic, which re-tags its questions.
 */
export function TopicsTab({ onChange }: { onChange: () => void }) {
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [filter, setFilter] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<{ name: string; label: string; mergeInto: string } | null>(null);
  const { flash, run } = useFlash();

  const load = useCallback(async () => {
    const r = await adminJson<{ items: Topic[] }>('/topics');
    setTopics(r.items);
  }, []);
  useEffect(() => {
    void run(load);
  }, [load, run]);

  const proposed = useMemo(() => (topics ?? []).filter((t) => t.status === 'proposed'), [topics]);
  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return proposed.filter((t) => !f || t.label.toLowerCase().includes(f) || t.courseCodes.some((c) => c.toLowerCase().includes(f))).sort((a, b) => b.questionCount - a.questionCount);
  }, [proposed, filter]);
  const labelOf = useMemo(() => new Map((topics ?? []).map((t) => [t.label.toLowerCase(), t.name])), [topics]);

  const done = async () => {
    setPicked(new Set());
    setEdit(null);
    await load();
    onChange();
  };
  const [approvedMsg, setApprovedMsg] = useState('');
  const approve = (names: string[]) =>
    run(async () => {
      setApprovedMsg('');
      const r = await adminJson<{ approved: number }>('/topics/approve', send('POST', { names }));
      setApprovedMsg(`Approved ${r.approved} topic${r.approved === 1 ? '' : 's'}`); // the server's count, not the request's
      await done();
    });
  // Only what is on screen can be approved: a narrower filter drops earlier picks that are now hidden.
  const pickedShown = shown.filter((t) => picked.has(t.name)).map((t) => t.name);
  const saveEdit = () =>
    run(async () => {
      if (!edit) return;
      const target = edit.mergeInto.trim() ? labelOf.get(edit.mergeInto.trim().toLowerCase()) : undefined;
      if (edit.mergeInto.trim() && !target) throw new Error(`No topic called "${edit.mergeInto.trim()}"`);
      if (target === edit.name) throw new Error('A topic cannot be merged into itself');
      await adminJson(`/topics/${encodeURIComponent(edit.name)}`, send('PATCH', target ? { mergeInto: target } : { label: edit.label.trim(), status: 'approved' }));
      await done();
    }, edit?.mergeInto.trim() ? 'Merged; its questions now carry the other topic' : 'Saved and approved');

  if (!topics) return flash ?? <p className="muted">Loading topics…</p>;
  const toggle = (name: string) => setPicked((p) => {
    const n = new Set(p);
    if (n.has(name)) n.delete(name);
    else n.add(name);
    return n;
  });

  return (
    <div className="stack gap-16">
      {flash}
      {approvedMsg && !flash && <p className="dash-flash ok" role="status">{approvedMsg}</p>}
      <div className="panel panel-pad">
        <p className="small muted">
          {proposed.length} proposed, {topics.length - proposed.length} approved. Approved topics are the vocabulary the tagger
          prefers for new papers; a proposed one is still searchable but may be a near-duplicate.
        </p>
        <div className="row gap-10 wrap" style={{ marginTop: 14 }}>
          <input className="input" style={{ maxWidth: 320 }} placeholder="Filter by name or course code" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter topics" />
          <button type="button" className="btn btn-primary btn-sm" disabled={!pickedShown.length} onClick={() => approve(pickedShown)}>
            Approve selected ({pickedShown.length})
          </button>
          <button type="button" className="btn btn-outline btn-sm" disabled={!shown.length} onClick={() => confirm(`Approve all ${shown.length} topics shown?`) && approve(shown.map((t) => t.name))}>
            Approve all shown ({shown.length})
          </button>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="panel panel-pad muted">{proposed.length ? 'No proposed topic matches the filter.' : 'Every topic is approved.'}</div>
      ) : (
        <div className="panel table-wrap">
          <table className="table dash-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" aria-label="Select all shown" checked={shown.every((t) => picked.has(t.name))} onChange={(e) => setPicked(e.target.checked ? new Set(shown.map((t) => t.name)) : new Set())} />
                </th>
                <th>Topic</th>
                <th>Courses</th>
                <th className="num">Questions</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((t) =>
                edit?.name === t.name ? (
                  <tr key={t.name}>
                    <td />
                    <td colSpan={4}>
                      <div className="dash-edit">
                        <label className="label" htmlFor="topic-label">Label</label>
                        <input id="topic-label" className="input" value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} />
                        <label className="label" htmlFor="topic-merge">Or merge into an existing topic (its exact name)</label>
                        <input id="topic-merge" className="input" list="topic-names" value={edit.mergeInto} onChange={(e) => setEdit({ ...edit, mergeInto: e.target.value })} placeholder="Leave empty to keep it" />
                        <datalist id="topic-names">{topics.filter((x) => x.name !== t.name).map((x) => <option key={x.name} value={x.label} />)}</datalist>
                        <div className="row gap-10">
                          <button type="button" className="btn btn-primary btn-sm" onClick={saveEdit} disabled={edit.label.trim().length < 2}>{edit.mergeInto.trim() ? 'Merge' : 'Save and approve'}</button>
                          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setEdit(null)}>Cancel</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={t.name}>
                    <td><input type="checkbox" aria-label={`Select ${t.label}`} checked={picked.has(t.name)} onChange={() => toggle(t.name)} /></td>
                    <td>{t.label}</td>
                    <td className="small muted">{t.courseCodes.join(', ') || '–'}</td>
                    <td className="num">{t.questionCount}</td>
                    <td className="dash-cell-actions">
                      <button type="button" className="btn btn-quiet btn-sm" onClick={() => approve([t.name])}>Approve</button>
                      <button type="button" className="btn btn-quiet btn-sm" onClick={() => setEdit({ name: t.name, label: t.label, mergeInto: '' })}>Edit</button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
