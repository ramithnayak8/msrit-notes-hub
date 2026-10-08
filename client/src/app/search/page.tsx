'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { SearchBox, ExampleQueries } from '@/components/SearchBox';
import { QuestionResult } from '@/components/QuestionResult';
import { Icon } from '@/components/ui/Icon';
import type { SearchResponse } from '@/lib/api';

const EXAMPLES = [
  'shortest path from a single source',
  'agile vs waterfall',
  'ML confusion matrix',
  'DAA greedy algorithms 2023',
  'copyright infringement remedies',
  'using a stack to rewrite arithmetic expressions',
];

const MODES = [
  { id: 'hybrid', label: 'Hybrid', hint: 'Keyword and meaning searches, merged' },
  { id: 'keyword', label: 'Keyword', hint: 'BM25 over question text and topic tags' },
  { id: 'vector', label: 'Meaning', hint: 'Nearest questions by embedding similarity' },
] as const;
type Mode = (typeof MODES)[number]['id'];

function ResultSkeleton() {
  return (
    <div aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton-result">
          <span className="skeleton skeleton-line" style={{ width: 160 }} />
          <span className="skeleton skeleton-line" style={{ width: '92%', height: 18 }} />
          <span className="skeleton skeleton-line" style={{ width: '70%', height: 18 }} />
          <span className="skeleton skeleton-line" style={{ width: 260 }} />
        </div>
      ))}
    </div>
  );
}

function countBy<T>(items: T[], key: (item: T) => (string | number | undefined)[]) {
  const counts = new Map<string | number, number>();
  for (const item of items) for (const k of key(item)) if (k !== undefined) counts.set(k, (counts.get(k) ?? 0) + 1);
  return counts;
}

function SearchResults() {
  const params = useSearchParams();
  const q = params.get('q') ?? '';
  const mode = (MODES.some((m) => m.id === params.get('mode')) ? params.get('mode') : 'hybrid') as Mode;
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (query: string, m: Mode) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&mode=${m}&limit=25`);
      if (!response.ok) throw new Error(`Search failed (${response.status})`);
      setData(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (q) run(q, mode);
    else setData(null);
  }, [q, mode, run]);

  // Keep the previous results on screen (dimmed) while the next query loads.
  const stale = loading && data !== null;
  const terms = data?.query.text.split(/\s+/).filter(Boolean) ?? [];
  const years = data ? [...countBy(data.hits, (h) => [h.year]).entries()].sort((a, b) => Number(b[0]) - Number(a[0])) : [];
  const maxYearCount = Math.max(...years.map(([, n]) => n), 1);
  const topicLabels = new Map(data?.hits.flatMap((h) => h.topics.map((t) => [t.name, t.label] as const)) ?? []);
  const topics = data ? [...countBy(data.hits, (h) => h.topics.map((t) => t.name)).entries()].sort((a, b) => b[1] - a[1]).slice(0, 8) : [];
  const repeated = data?.hits.filter((h) => h.recurrence.count > 1).length ?? 0;

  return (
    <main>
      <section className="page-head" style={{ paddingBottom: 'var(--space-6)' }}>
        <div className="shell">
          <p className="eyebrow">Search the archive</p>
          <h1 className="visually-hidden">Search questions</h1>
          <div style={{ marginTop: 16, maxWidth: 820 }}>
            <SearchBox key={q} initial={q} large autoFocus={!q} />
          </div>

          {!q && (
            <div style={{ marginTop: 16 }}>
              <ExampleQueries queries={EXAMPLES} />
            </div>
          )}

          {q && (
            <div className="row gap-6 wrap" style={{ marginTop: 14 }} role="group" aria-label="Search mode">
              {MODES.map((m) => (
                <Link
                  key={m.id}
                  href={`/search?q=${encodeURIComponent(q)}${m.id === 'hybrid' ? '' : `&mode=${m.id}`}`}
                  className={`btn btn-sm ${mode === m.id ? 'btn-primary' : 'btn-outline'}`}
                  aria-current={mode === m.id ? 'true' : undefined}
                  title={m.hint}
                >
                  {m.label}
                </Link>
              ))}
            </div>
          )}

          <div aria-live="polite" aria-atomic="true">
            {data && (
              <div className={`interpret${stale ? ' is-stale' : ''}`} style={{ marginTop: 16 }}>
                <span className="label" style={{ color: 'var(--accent)' }}>Interpreted as</span>
                {data.query.understood.map((part) => (
                  <span key={part} className="tag tag-accent">{part}</span>
                ))}
                {data.query.text && <span className="tag">topic: {data.query.text}</span>}
                <span className="muted xs nums">
                  {data.total} match{data.total === 1 ? '' : 'es'} · {data.tookMs} ms · no language model used
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section style={{ paddingBottom: 'var(--space-16)' }}>
        <div className="shell">
          {loading && !data && <ResultSkeleton />}

          {error && (
            <div className="notice row between wrap gap-12" style={{ borderLeftColor: 'var(--negative)' }} role="alert">
              <span>{error}. Is the API server running (npm run dev:server)?</span>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => run(q, mode)}>
                <Icon name="reset" size={15} /> Try again
              </button>
            </div>
          )}

          {!q && !loading && (
            <div className="empty">
              <span className="empty-mark"><Icon name="bookOpen" size={40} strokeWidth={1.2} /></span>
              <p className="empty-title">What are you revising today?</p>
              <p className="small" style={{ marginTop: 8 }}>
                Search by concept, not by subject code. Add a course (&ldquo;ML&rdquo;, &ldquo;CS43&rdquo;), a year range or
                &ldquo;10 marks&rdquo; and they become filters. Tip: press <span className="kbd">/</span> to jump to a course.
              </p>
            </div>
          )}

          {data && data.hits.length === 0 && (
            <div className={`empty${stale ? ' is-stale' : ''}`}>
              <span className="empty-mark"><Icon name="search" size={40} strokeWidth={1.2} /></span>
              <p className="empty-title">Nothing on the shelves for that</p>
              <p className="small" style={{ marginTop: 8 }}>Try removing a filter, or search for a broader topic.</p>
            </div>
          )}

          {data && data.hits.length > 0 && (
            <div className={`search-layout${stale ? ' is-stale' : ''}`} aria-busy={stale || undefined}>
              <div className="divide">
                {data.hits.map((hit, i) => (
                  <QuestionResult key={hit.id} hit={hit} rank={i + 1} terms={terms} />
                ))}
                {data.total > data.hits.length && (
                  <p className="small muted" style={{ paddingTop: 22 }}>
                    Showing the top {data.hits.length} of {data.total} matches.
                  </p>
                )}
              </div>

              <aside className="stack gap-20 search-aside" aria-label="Result breakdown">
                <div className="panel panel-pad">
                  <div className="label">By year</div>
                  <div className="stack gap-10" style={{ marginTop: 14 }}>
                    {years.map(([year, count]) => (
                      <div key={year}>
                        <div className="row between xs soft nums">
                          <span>{year}</span>
                          <span>{count}</span>
                        </div>
                        <div className="bar-track" style={{ marginTop: 5 }}>
                          <div className="bar-fill" style={{ width: `${(count / maxYearCount) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel panel-pad">
                  <div className="label">Topics in these results</div>
                  <div className="stack gap-8" style={{ marginTop: 14 }}>
                    {topics.map(([name, count]) => (
                      <Link key={name} href={`/search?q=${encodeURIComponent(topicLabels.get(String(name)) ?? String(name))}`} className="row between gap-10 small">
                        <span className="soft">{topicLabels.get(String(name)) ?? name}</span>
                        <span className="muted nums xs">{count}</span>
                      </Link>
                    ))}
                  </div>
                  {repeated > 0 && (
                    <p className="xs muted" style={{ marginTop: 14 }}>
                      {repeated} of these questions were asked in more than one paper.
                    </p>
                  )}
                </div>

                <div className="panel panel-pad">
                  <div className="label">How this was ranked</div>
                  <p className="xs muted" style={{ marginTop: 10, lineHeight: 1.6 }}>
                    {mode === 'hybrid' && 'Two searches ran with the same filters: keyword (BM25) and meaning (embedding similarity). Their rankings were merged by reciprocal rank fusion, so a question found by both rises to the top.'}
                    {mode === 'keyword' && 'Keyword only: BM25 over the question text, topic tags and course title. Strong on exact terms, blind to paraphrases.'}
                    {mode === 'vector' && 'Meaning only: the query is embedded locally and the nearest questions are found with Atlas Vector Search. Finds paraphrases, but can drift.'}
                  </p>
                </div>
              </aside>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="shell section-sm"><ResultSkeleton /></div>}>
      <SearchResults />
    </Suspense>
  );
}
