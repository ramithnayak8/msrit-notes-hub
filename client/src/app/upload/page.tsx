'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { authFetch, canUpload, errorMessage, useAuth } from '@/lib/client/auth';
import { paperFileUrl } from '@/lib/api';

const STAGES = [
  { id: 'extract', label: 'Extract', hint: 'Text layer, or OCR for scanned pages' },
  { id: 'segment', label: 'Segment', hint: 'Split into questions; the language model only for what the rules miss' },
  { id: 'tag', label: 'Tag', hint: 'One batched call picks concept topics from the vocabulary' },
  { id: 'embed', label: 'Embed', hint: 'Local sentence embeddings, no API cost' },
  { id: 'write', label: 'Index', hint: 'Store, group repeated questions, update search indexes' },
] as const;

type DocStatus = {
  document: {
    _id: string;
    title: string;
    status: string;
    courseCode?: string;
    courseTitle?: string;
    year?: number;
    month?: string;
    examType?: string;
    branch?: string;
    questionCount: number;
    pageCount?: number;
    textSource?: string;
    error?: string;
  };
  job: { status: string; stage?: string; attempts: number; timings?: Record<string, number>; lastError?: string } | null;
  openReviews: number;
};

type Question = { _id: string; label: string; text: string; marks?: number; topics: string[]; segmentConfidence?: number };
type RecentDoc = DocStatus['document'] & { createdAt: string };

const DONE = ['ready', 'needs_review', 'failed'];

export default function UploadPage() {
  const { user, ready } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<'question_paper' | 'notes'>('question_paper');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [status, setStatus] = useState<DocStatus | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [recent, setRecent] = useState<RecentDoc[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const startedAt = useRef<number>(0);

  const loadRecent = useCallback(() => {
    fetch('/api/documents?limit=8')
      .then((r) => r.json())
      .then((d) => setRecent(d.items ?? []))
      .catch(() => {});
  }, []);
  useEffect(loadRecent, [loadRecent]);

  // Poll the document while the pipeline runs.
  useEffect(() => {
    if (!docId) return;
    let stop = false;
    const tick = async () => {
      const res = await fetch(`/api/documents/${docId}`);
      if (!res.ok || stop) return;
      const data: DocStatus = await res.json();
      setStatus(data);
      if (DONE.includes(data.document.status) && data.job && !['queued', 'running'].includes(data.job.status)) {
        const q = await fetch(`/api/documents/${docId}/questions`).then((r) => r.json());
        setQuestions(q.items ?? []);
        loadRecent();
        return;
      }
      if (!stop) setTimeout(tick, 1500);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [docId, loadRecent]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    setQuestions([]);
    try {
      const form = new FormData();
      form.append('kind', kind);
      form.append('file', file);
      const res = await authFetch('/api/documents', { method: 'POST', body: form });
      if (res.status === 409) {
        const body = await res.json();
        setError('This exact file is already in the archive.');
        setDocId(body?.error?.details?.documentId ?? null);
        return;
      }
      if (!res.ok) throw new Error(await errorMessage(res));
      const body = await res.json();
      startedAt.current = Date.now();
      setDocId(body.document._id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <main className="shell section-sm" />;

  if (!user || !canUpload(user)) {
    return (
      <main>
        <section className="page-head">
          <div className="shell-narrow">
            <p className="eyebrow">Contribute</p>
            <h1>Upload a paper</h1>
            <p className="lead" style={{ marginTop: 10 }}>
              {user
                ? `You're signed in as ${user.email}, but uploading needs the uploader role. Ask a moderator to grant it.`
                : 'Sign in with an account that has uploader access to add papers to the archive.'}
            </p>
            {!user && (
              <Link href="/login?next=/upload" className="btn btn-primary" style={{ marginTop: 20 }}>
                Sign in
              </Link>
            )}
          </div>
        </section>
      </main>
    );
  }

  const doc = status?.document;
  const job = status?.job;
  const finished = !!doc && DONE.includes(doc.status) && !!job && !['queued', 'running'].includes(job.status);
  const stageState = (id: string) => {
    if (job?.timings?.[id] !== undefined) return 'done';
    if (job?.stage === id && job.status === 'running') return 'active';
    return 'waiting';
  };

  return (
    <main>
      <section className="page-head">
        <div className="shell">
          <p className="eyebrow">Contribute</p>
          <h1>Upload a paper</h1>
          <p className="lead" style={{ marginTop: 10, maxWidth: 720 }}>
            Drop in a question paper (PDF, scanned PDF or a phone photo). Course, year and exam are read from the paper&rsquo;s
            own header, so you don&rsquo;t need to type them.
          </p>
        </div>
      </section>

      <section style={{ paddingBottom: 'var(--space-16)' }}>
        <div className="shell course-layout">
          <div className="stack gap-24">
            <form className="panel panel-pad stack gap-16" onSubmit={onSubmit}>
              <div
                className="panel panel-pad center"
                style={{ borderStyle: 'dashed', cursor: 'pointer', background: dragging ? 'var(--surface-2, rgba(255,255,255,0.04))' : undefined }}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
                }}
              >
                <Icon name="upload" size={28} />
                <p style={{ marginTop: 10 }}>{file ? <strong>{file.name}</strong> : 'Drop a file here, or click to choose'}</p>
                <p className="xs muted" style={{ marginTop: 4 }}>
                  {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'PDF, PNG or JPEG, up to 25 MB'}
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  hidden
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <div className="row gap-12 wrap" style={{ alignItems: 'center' }}>
                <label className="row gap-8 small">
                  <input type="radio" checked={kind === 'question_paper'} onChange={() => setKind('question_paper')} /> Question paper
                </label>
                <label className="row gap-8 small">
                  <input type="radio" checked={kind === 'notes'} onChange={() => setKind('notes')} /> Notes
                </label>
                <button type="submit" className="btn btn-primary" disabled={!file || busy} style={{ marginLeft: 'auto' }}>
                  {busy ? 'Uploading…' : 'Upload and process'}
                </button>
              </div>
              {error && (
                <p className="small" style={{ color: 'var(--negative)' }} role="alert">
                  {error}
                </p>
              )}
            </form>

            {doc && (
              <div className="panel panel-pad" aria-live="polite">
                <div className="row between wrap gap-12">
                  <div>
                    <div className="label">Processing</div>
                    <p style={{ marginTop: 6, fontWeight: 600 }}>{doc.title}</p>
                  </div>
                  <span className={`tag ${doc.status === 'ready' ? 'tag-positive' : doc.status === 'failed' ? '' : 'tag-amber'}`}>{doc.status.replace('_', ' ')}</span>
                </div>

                <ol className="stack gap-10" style={{ marginTop: 18, listStyle: 'none', padding: 0 }}>
                  {STAGES.map((s) => {
                    const st = stageState(s.id);
                    const ms = job?.timings?.[s.id];
                    return (
                      <li key={s.id} className="row gap-12" style={{ alignItems: 'flex-start', opacity: st === 'waiting' ? 0.5 : 1 }}>
                        <span style={{ width: 22, flexShrink: 0, marginTop: 2 }}>
                          {st === 'done' ? <Icon name="check" size={18} /> : st === 'active' ? <span className="spinner" /> : <span className="muted">·</span>}
                        </span>
                        <span>
                          <strong>{s.label}</strong> <span className="xs muted">{s.hint}</span>
                          {ms !== undefined && <span className="xs muted nums"> · {(ms / 1000).toFixed(1)} s</span>}
                        </span>
                      </li>
                    );
                  })}
                </ol>

                {job?.lastError && !finished && <p className="xs muted" style={{ marginTop: 12 }}>Retrying after: {job.lastError.slice(0, 160)}</p>}
                {doc.error && <p className="small" style={{ marginTop: 12, color: 'var(--negative)' }}>{doc.error}</p>}

                {finished && doc.status !== 'failed' && (
                  <div style={{ marginTop: 18 }}>
                    <p className="small">
                      Found <strong>{doc.questionCount}</strong> questions
                      {doc.courseCode ? <> in <strong>{doc.courseCode}</strong> {doc.courseTitle}</> : ''}
                      {doc.examType ? `, ${doc.examType}` : ''}
                      {doc.month || doc.year ? ` ${[doc.month, doc.year].filter(Boolean).join(' ')}` : ''}
                      {doc.textSource === 'ocr' ? ' (scanned, read with OCR)' : ''}.
                      {status?.openReviews ? ` ${status.openReviews} item(s) were sent to the moderators for a check.` : ''}
                    </p>
                    <div className="row gap-10 wrap" style={{ marginTop: 12 }}>
                      {doc.courseCode && (
                        <Link href={`/courses/${doc.courseCode}`} className="btn btn-primary btn-sm">
                          Open the course
                        </Link>
                      )}
                      <a href={paperFileUrl(doc._id)} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                        <Icon name="file" size={15} /> View the PDF
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

            {questions.length > 0 && (
              <div className="panel">
                <div className="divide">
                  {questions.map((q) => (
                    <article key={q._id} className="question-card">
                      <div className="row between gap-10">
                        <span className="result-cite">{q.label}</span>
                        <span className="xs muted">
                          {q.marks !== undefined ? `${q.marks} marks` : ''}
                          {q.segmentConfidence !== undefined && q.segmentConfidence < 0.6 ? ' · flagged for review' : ''}
                        </span>
                      </div>
                      <p className="reading" style={{ marginTop: 8 }}>{q.text}</p>
                      {q.topics.length > 0 && (
                        <div className="row wrap gap-6" style={{ marginTop: 10 }}>
                          {q.topics.map((t) => (
                            <span key={t} className="tag">{t.replace(/-/g, ' ')}</span>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="stack gap-24 course-aside">
            <div className="panel panel-pad">
              <div className="label">Recent uploads</div>
              <div className="stack gap-10" style={{ marginTop: 14 }}>
                {recent.map((d) => (
                  <button key={d._id} type="button" className="row between gap-10 small btn-quiet" style={{ textAlign: 'left', background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit' }} onClick={() => setDocId(d._id)}>
                    <span className="soft">
                      {d.courseCode ?? '—'} · {[d.examType, d.year].filter(Boolean).join(' ')}
                    </span>
                    <span className="xs muted">{d.status === 'ready' ? `${d.questionCount} Q` : d.status.replace('_', ' ')}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="panel panel-pad">
              <div className="label">What happens</div>
              <p className="xs muted" style={{ marginTop: 10, lineHeight: 1.6 }}>
                The upload is type-checked from its bytes, de-duplicated by SHA-256 and queued. A background worker runs the
                stages; each saves its output, so a failure retries from where it stopped.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
