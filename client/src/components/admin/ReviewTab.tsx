'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminJson, send, type ReviewItem } from '@/lib/client/admin';
import { useFlash } from './useFlash';

const TYPE_LABEL: Record<ReviewItem['type'], string> = { segment: 'Split unclear', ocr: 'Scan unclear', metadata: 'Paper details', topic: 'New topic' };

/** Questions and papers the pipeline flagged: fix the text, or dismiss when it was right. */
export function ReviewTab({ onChange }: { onChange: () => void }) {
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string; marks: string } | null>(null);
  const { flash, run } = useFlash();

  const load = useCallback(async () => {
    const r = await adminJson<{ items: ReviewItem[] }>('/review');
    setItems(r.items.filter((i) => i.type !== 'topic')); // proposed topics have their own tab
  }, []);
  useEffect(() => {
    void run(load);
  }, [load, run]);

  const done = async () => {
    await load();
    onChange();
  };
  const dismiss = (i: ReviewItem) => run(async () => (await adminJson(`/review/${i._id}/resolve`, send('POST', { status: 'dismissed', resolution: 'looks right' })), await done()), 'Dismissed');
  const save = () =>
    run(async () => {
      if (!editing) return;
      const marks = editing.marks.trim() === '' ? null : Number(editing.marks);
      if (marks !== null && (!Number.isInteger(marks) || marks < 0 || marks > 100)) throw new Error('Marks must be a whole number from 0 to 100');
      // Editing a question resolves its open review items on the server.
      await adminJson(`/questions/${editing.id}`, send('PATCH', { text: editing.text, marks }));
      setEditing(null);
      await done();
    }, 'Question saved and re-indexed');

  if (!items) return flash ?? <p className="muted">Loading the queue…</p>;
  return (
    <div className="stack gap-16">
      {flash}
      {items.length === 0 ? (
        <div className="panel panel-pad muted">Nothing flagged. Every question the pipeline split or read from a scan looked confident.</div>
      ) : (
        items.map((i) => (
          <article key={i._id} className="panel panel-pad dash-item">
            <div className="row between wrap gap-10">
              <span className="row gap-10 wrap">
                <span className="tag tag-amber">{TYPE_LABEL[i.type]}</span>
                <span className="small muted">
                  {i.documentId ? `${i.documentId.courseCode ?? ''} ${i.documentId.year ?? ''} · ${i.documentId.title}` : 'Unknown paper'}
                  {i.questionId ? ` · ${i.questionId.label}` : ''}
                </span>
              </span>
              <span className="xs muted">{new Date(i.createdAt).toLocaleDateString('en-IN')}</span>
            </div>
            <p className="small" style={{ marginTop: 8 }}>{i.reason}</p>
            {i.questionId &&
              (editing?.id === i.questionId._id ? (
                <div className="dash-edit">
                  <label className="label" htmlFor={`text-${i._id}`}>Question text</label>
                  <textarea id={`text-${i._id}`} className="input" rows={4} value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} />
                  <label className="label" htmlFor={`marks-${i._id}`}>Marks</label>
                  <input id={`marks-${i._id}`} className="input" inputMode="numeric" value={editing.marks} onChange={(e) => setEditing({ ...editing, marks: e.target.value })} style={{ maxWidth: 120 }} />
                  <div className="row gap-10">
                    <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={editing.text.trim().length < 3}>Save</button>
                    <button type="button" className="btn btn-quiet btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="reading dash-quote">{i.questionId.text}{i.questionId.marks != null ? ` (${i.questionId.marks} marks)` : ''}</p>
              ))}
            {editing?.id !== i.questionId?._id && (
              <div className="row gap-10" style={{ marginTop: 12 }}>
                {i.questionId && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing({ id: i.questionId!._id, text: i.questionId!.text, marks: i.questionId!.marks?.toString() ?? '' })}>
                    Fix the question
                  </button>
                )}
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => dismiss(i)}>It&rsquo;s right, dismiss</button>
              </div>
            )}
          </article>
        ))
      )}
    </div>
  );
}
