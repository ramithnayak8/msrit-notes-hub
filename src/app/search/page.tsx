'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SearchBox, ExampleQueries } from '@/components/SearchBox';
import { QuestionResult } from '@/components/QuestionResult';
import type { SearchResponse } from '@/lib/types';

const EXAMPLES = [
  'binary tree questions from the last 3 years',
  'deadlock CS501',
  'normalization 10 marks',
  'neural networks CSE',
  'shortest path algorithms since 2022',
];

function SearchResults() {
  const params = useSearchParams();
  const q = params.get('q') ?? '';
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=25`);
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
    if (q) run(q);
    else setData(null);
  }, [q, run]);

  const maxYearCount = data ? Math.max(...data.yearSummary.map((y) => y.count), 1) : 1;

  return (
    <main>
      <section className="section-sm">
        <div className="shell">
          <SearchBox key={q} initial={q} large autoFocus={!q} />

          {!q && (
            <div style={{ marginTop: 16 }}>
              <ExampleQueries queries={EXAMPLES} />
            </div>
          )}

          {data && !loading && (
            <div className="interpret" style={{ marginTop: 16 }}>
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
      </section>

      <section style={{ paddingBottom: 72 }}>
        <div className="shell">
          {loading && (
            <div className="row gap-10 muted small" style={{ padding: '40px 0' }}>
              <span className="spinner" />
              Searching the index…
            </div>
          )}

          {error && (
            <div className="notice" style={{ borderLeftColor: 'var(--negative)' }}>
              {error}
            </div>
          )}

          {!q && !loading && (
            <div className="empty">
              <p className="serif" style={{ fontSize: 19, color: 'var(--ink)' }}>
                Search across {`every indexed question`}
              </p>
              <p className="small" style={{ marginTop: 8 }}>
                Try a topic, a course code, or a full sentence with a time range.
              </p>
            </div>
          )}

          {data && !loading && data.hits.length === 0 && (
            <div className="empty">
              <p className="serif" style={{ fontSize: 19, color: 'var(--ink)' }}>
                No questions matched that query
              </p>
              <p className="small" style={{ marginTop: 8 }}>
                Try removing a filter, or search for a broader topic such as
                &ldquo;trees&rdquo; or &ldquo;scheduling&rdquo;.
              </p>
            </div>
          )}

          {data && !loading && data.hits.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 260px',
                gap: 48,
                alignItems: 'start',
              }}
              className="search-layout"
            >
              <div className="divide">
                {data.hits.map((hit, i) => (
                  <QuestionResult key={hit.id} hit={hit} rank={i + 1} />
                ))}
                {data.total > data.hits.length && (
                  <p className="small muted" style={{ paddingTop: 22 }}>
                    Showing the top {data.hits.length} of {data.total} matches.
                  </p>
                )}
              </div>

              <aside className="stack gap-24" style={{ position: 'sticky', top: 86 }}>
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
                          <div
                            className="bar-fill"
                            style={{ width: `${(y.count / maxYearCount) * 100}%` }}
                          />
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
                      <span
                        key={t.term}
                        className={`tag${t.weight >= 0.9 ? ' tag-accent' : ''}`}
                        title={`weight ${t.weight.toFixed(2)}`}
                      >
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

      <style>{`
        @media (max-width: 900px) {
          .search-layout { grid-template-columns: minmax(0, 1fr) !important; gap: 32px !important; }
          .search-layout aside { position: static !important; }
        }
      `}</style>
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="shell section-sm"><span className="spinner" /></div>}>
      <SearchResults />
    </Suspense>
  );
}
