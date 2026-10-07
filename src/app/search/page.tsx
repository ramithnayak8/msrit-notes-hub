'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { SearchBox, ExampleQueries } from '@/components/SearchBox';
import { QuestionResult } from '@/components/QuestionResult';
import { Icon } from '@/components/ui/Icon';
import type { SearchResponse } from '@/lib/types';

type SearchData = SearchResponse & { papers?: { code: string; title: string; papers: number }[] };
const PAGE = 25;

const EXAMPLES = [
  'binary tree questions from the last 3 years',
  'deadlock CS501',
  'normalization 10 marks',
  'neural networks CSE',
  'shortest path algorithms since 2022',
];

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

function SearchResults() {
  const params = useSearchParams();
  const q = params.get('q') ?? '';
  const [data, setData] = useState<SearchData | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=50`);
      if (!response.ok) throw new Error(`Search failed (${response.status})`);
      setData(await response.json());
      setShown(PAGE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (q) run(q);
    else setData(null);
  }, [q, run]);

  const maxYearCount = data ? Math.max(...data.yearSummary.map((y) => y.count), 1) : 1;
  // Keep the previous results on screen (dimmed) while the next query loads.
  const stale = loading && data !== null;

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

          <div aria-live="polite" aria-atomic="true">
            {data && (
              <div className={`interpret${stale ? ' is-stale' : ''}`} style={{ marginTop: 16 }}>
                <span className="label" style={{ color: 'var(--accent)' }}>Interpreted as</span>
                {data.query.explanation.length ? (
                  data.query.explanation.map((part) => (
                    <span key={part} className="tag tag-accent">{part}</span>
                  ))
                ) : (
                  <span className="tag tag-accent">free text</span>
                )}
                <span className="muted xs nums">
                  {data.total} match{data.total === 1 ? '' : 'es'} · {data.tookMs} ms
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
              <span>{error}. The archive could not be reached.</span>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => run(q)}>
                <Icon name="reset" size={15} /> Try again
              </button>
            </div>
          )}

          {!q && !loading && (
            <div className="empty">
              <span className="empty-mark"><Icon name="bookOpen" size={40} strokeWidth={1.2} /></span>
              <p className="empty-title">What are you revising today?</p>
              <p className="small" style={{ marginTop: 8 }}>
                Try a topic, a course code, or a full sentence with a time range. Tip: press{' '}
                <span className="kbd">/</span> anywhere to jump straight to a course.
              </p>
            </div>
          )}

          {data && data.hits.length === 0 && (
            <div className={`empty${stale ? ' is-stale' : ''}`}>
              <span className="empty-mark"><Icon name="search" size={40} strokeWidth={1.2} /></span>
              <p className="empty-title">Nothing on the shelves for that</p>
              <p className="small" style={{ marginTop: 8 }}>
                Try removing a filter, or search for a broader topic such as &ldquo;trees&rdquo; or
                &ldquo;scheduling&rdquo;.
              </p>
            </div>
          )}

          {data && data.hits.length > 0 && (
            <div className={`search-layout${stale ? ' is-stale' : ''}`} aria-busy={stale || undefined}>
              <div className="divide">
                {data.hits.slice(0, shown).map((hit, i) => (
                  <QuestionResult key={hit.id} hit={hit} rank={i + 1} />
                ))}
                {data.hits.length > shown ? (
                  <div style={{ paddingTop: 22 }}>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setShown(data.hits.length)}>
                      Show {data.hits.length - shown} more match{data.hits.length - shown === 1 ? '' : 'es'}
                    </button>
                  </div>
                ) : (
                  data.total > data.hits.length && (
                    <p className="small muted" style={{ paddingTop: 22 }}>
                      Showing the top {data.hits.length} of {data.total} matches. Add a course or year to narrow it down.
                    </p>
                  )
                )}
              </div>

              <aside className="stack gap-20 search-aside" aria-label="Result breakdown">
                {data.papers && data.papers.length > 0 && (
                  <div className="panel panel-pad search-papers">
                    <div className="label">Full past papers</div>
                    <p className="xs muted" style={{ marginTop: 6 }}>Whole papers for the courses these questions come from.</p>
                    <div className="stack gap-6" style={{ marginTop: 12 }}>
                      {data.papers.map((c) => (
                        <Link key={c.code} href={`/courses/${c.code}#more-papers`} className="topic-row">
                          <span>{c.title}</span>
                          <span className="muted nums xs">{c.papers}</span>
                        </Link>
                      ))}
                    </div>
                    <Link href={`/papers?q=${encodeURIComponent(data.papers[0].title)}`} className="small" style={{ display: 'inline-flex', gap: 4, alignItems: 'center', marginTop: 12 }}>
                      Open the library <Icon name="arrowRight" size={14} />
                    </Link>
                  </div>
                )}
                <div className="panel panel-pad">
                  <div className="label">By year</div>
                  <div className="stack gap-10" style={{ marginTop: 14 }}>
                    {data.yearSummary.map((y) => (
                      <div key={y.year}>
                        <div className="row between xs soft nums">
                          <span>{y.year}</span>
                          <span>{y.count}</span>
                        </div>
                        <div className="bar-track" style={{ marginTop: 5 }}>
                          <div className="bar-fill" style={{ width: `${(y.count / maxYearCount) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel panel-pad">
                  <div className="label">Recurring topics</div>
                  <div className="stack gap-8" style={{ marginTop: 14 }}>
                    {data.topicSummary.map((t) => (
                      <div key={t.topic} className="row between gap-10 small">
                        <span className="soft">{t.topic}</span>
                        <span className="muted nums xs">{t.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel panel-pad">
                  <div className="label">Query expansion</div>
                  <p className="xs muted" style={{ marginTop: 10, lineHeight: 1.55 }}>
                    Related terms the engine also searched for, weighted by association strength.
                  </p>
                  <div className="row wrap gap-6" style={{ marginTop: 12 }}>
                    {data.query.expandedTerms.slice(0, 12).map((t) => (
                      <span key={t.term} className={`tag${t.weight >= 0.9 ? ' tag-accent' : ''}`} title={`weight ${t.weight.toFixed(2)}`}>
                        {t.term}
                      </span>
                    ))}
                  </div>
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
