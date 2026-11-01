'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PapersTab } from '@/components/admin/PapersTab';
import { ReviewTab } from '@/components/admin/ReviewTab';
import { TopicsTab } from '@/components/admin/TopicsTab';
import { UsersTab } from '@/components/admin/UsersTab';
import { adminJson, type Summary } from '@/lib/client/admin';
import { isModerator, useAuth } from '@/lib/client/auth';

const TABS = [
  { id: 'review', label: 'Review queue' },
  { id: 'topics', label: 'Topics' },
  { id: 'papers', label: 'Papers' },
  { id: 'users', label: 'Users' },
] as const;
type Tab = (typeof TABS)[number]['id'];

const sum = (r: Record<string, number>, ...keys: string[]) => (keys.length ? keys : Object.keys(r)).reduce((s, k) => s + (r[k] ?? 0), 0);
const mb = (b: number) => `${Math.round(b / 1048576)} MB`;

/**
 * The moderators' dashboard, on the real accounts: what needs a decision
 * (flagged questions, proposed topics, failed papers), and who can do what.
 * Every action is checked again by the API; this page only hides what a role can't use.
 */
export default function DashboardPage() {
  const { user, ready } = useAuth();
  const [tab, setTab] = useState<Tab>('review');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(() => {
    adminJson<Summary>('/admin/summary').then(
      (s) => (setSummary(s), setError('')),
      (e: Error) => setError(e.message),
    );
  }, []);
  useEffect(() => {
    if (isModerator(user)) refresh();
  }, [user, refresh]);

  if (!ready) return <Shell><p className="muted">Checking your session…</p></Shell>;
  if (!user)
    return (
      <Shell>
        <div className="panel panel-pad dash-gate">
          <p>The dashboard is for moderators. <Link href="/login">Sign in</Link> with a moderator account to use it.</p>
        </div>
      </Shell>
    );
  if (!isModerator(user))
    return (
      <Shell>
        <div className="panel panel-pad dash-gate">
          <p>You&rsquo;re signed in as {user.email} with the <strong>{user.role}</strong> role. The dashboard needs the moderator role; ask a moderator to grant it.</p>
        </div>
      </Shell>
    );

  const reviewCount = summary ? sum(summary.openReviews, 'segment', 'ocr', 'metadata') : undefined;
  const proposed = summary?.topics.proposed;
  const counts: Partial<Record<Tab, number | undefined>> = { review: reviewCount, topics: proposed, papers: summary ? sum(summary.documents, 'failed', 'needs_review') : undefined };
  const storage = summary ? summary.storage.usedBytes / summary.storage.limitBytes : 0;

  return (
    <Shell>
      {error && <p className="dash-flash err" role="alert">{error}</p>}
      {summary && (
        <section className="panel panel-pad" aria-label="Archive at a glance">
          <div className="dash-tiles">
            <Tile label="Papers" value={sum(summary.documents)} note={summary.documents.failed ? `${summary.documents.failed} failed` : `${summary.documents.ready ?? 0} ready`} warn={!!summary.documents.failed} />
            <Tile label="Questions" value={summary.questions} />
            <Tile label="Topics waiting" value={proposed ?? 0} note={`${summary.topics.approved ?? 0} approved`} warn={!!proposed} />
            <Tile label="Flagged questions" value={reviewCount ?? 0} warn={!!reviewCount} />
            <Tile label="Accounts" value={sum(summary.users.byRole)} note={`${summary.users.byRole.moderator ?? 0} moderators, ${summary.users.byRole.uploader ?? 0} uploaders`} />
            <Tile label="AI answers today" value={summary.assistant.usedToday} note={`of ${summary.assistant.dailyLimit}`} />
          </div>
          <div className="dash-meter" style={{ marginTop: 20 }}>
            <div className="row between wrap gap-10 small">
              <span>Database storage</span>
              <span className="muted nums">{mb(summary.storage.usedBytes)} of {mb(summary.storage.limitBytes)} (free tier)</span>
            </div>
            <div className="dash-meter-track" role="meter" aria-label="Database storage used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(storage * 100)}>
              <span className="dash-meter-fill" data-level={storage > 0.85 ? 'high' : storage > 0.65 ? 'mid' : undefined} style={{ width: `${Math.min(100, storage * 100)}%` }} />
            </div>
            {storage > 0.65 && <p className="xs muted" style={{ marginTop: 6 }}>Run <code>npm run files:prune -w server</code> to free the space taken by PDFs that have a source link.</p>}
          </div>
        </section>
      )}

      <div className="dash-tabs" role="tablist" aria-label="Dashboard sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" id={`tab-${t.id}`} aria-controls={tab === t.id ? `panel-${t.id}` : undefined} aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
            {!!counts[t.id] && <span className="dash-count">{counts[t.id]}</span>}
          </button>
        ))}
      </div>
      <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'review' && <ReviewTab onChange={refresh} />}
        {tab === 'topics' && <TopicsTab onChange={refresh} />}
        {tab === 'papers' && <PapersTab onChange={refresh} />}
        {tab === 'users' && <UsersTab me={user.id} onChange={refresh} />}
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main>
      <section className="page-head" style={{ paddingBottom: 'var(--space-6)' }}>
        <div className="shell">
          <p className="eyebrow">Dashboard</p>
          <h1>Keep the archive right</h1>
          <p className="lead">Check what the pipeline wasn&rsquo;t sure about, approve topics, look after papers, and decide who can upload and moderate.</p>
        </div>
      </section>
      <div className="shell dash">{children}</div>
    </main>
  );
}

function Tile({ label, value, note, warn }: { label: string; value: number; note?: string; warn?: boolean }) {
  return (
    <div className="dash-tile">
      <div className="dash-tile-value">{value.toLocaleString('en-IN')}</div>
      <div className="dash-tile-label">
        {warn && <span className="dash-dot" aria-hidden />}
        {label}
      </div>
      {note && <div className="xs muted">{note}</div>}
    </div>
  );
}
