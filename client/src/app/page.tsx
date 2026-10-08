import Link from 'next/link';
import { Hero } from '@/components/hero/Hero';
import { QuestionResult } from '@/components/QuestionResult';
import { Bookshelf } from '@/components/browse/Bookshelf';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Tilt } from '@/components/ui/Tilt';
import { Counter } from '@/components/ui/Counter';
import { apiGet, type SchemeCourse, type SearchResponse, type Stats } from '@/lib/api';
import { getShelfBranches } from '@/lib/shelf-data';

export const dynamic = 'force-dynamic';

const EXAMPLES = [
  'shortest path from a single source',
  'ML confusion matrix',
  'agile vs waterfall',
  'DAA greedy algorithms 2023',
];

const DEMO_QUERY = 'connect all vertices with the least total edge cost';

const FEATURES: { icon: IconName; title: string; body: React.ReactNode }[] = [
  {
    icon: 'search',
    title: 'Search by what a question is about',
    body: (
      <>
        Every question is embedded and tagged with the concepts it tests, and keyword and meaning searches
        are merged, so &ldquo;least total edge cost&rdquo; finds Prim&rsquo;s and Kruskal&rsquo;s questions.
      </>
    ),
  },
  {
    icon: 'sparkles',
    title: 'Ask in plain English',
    body: (
      <>
        &ldquo;Last 3 years&rdquo;, &ldquo;10 marks&rdquo; and &ldquo;ML&rdquo; become real filters, and
        every search shows exactly how it read your request. No language model runs at search time.
      </>
    ),
  },
  {
    icon: 'diff',
    title: 'Survives syllabus revisions',
    body: (
      <>
        Course codes get reused and subjects renamed between schemes. Questions are filed by topic, and
        each current course is linked to past papers on the same subject, whatever their code.
      </>
    ),
  },
];

export default async function HomePage() {
  const [stats, branches, demo, scheme] = await Promise.all([
    apiGet<Stats>('/analytics/stats'),
    getShelfBranches(),
    apiGet<SearchResponse>(`/search?q=${encodeURIComponent(DEMO_QUERY)}&limit=3`),
    apiGet<{ items: SchemeCourse[] }>('/courses?semester=5'),
  ]);
  const years = stats.yearRange ?? { min: 0, max: 0 };
  const topics = Object.values(stats.topics).reduce((a, b) => a + b, 0);
  // The clearest example of why codes can't be trusted: a current course whose papers were set under another code.
  // Best of all: one whose old code now means a different subject (ML's papers sit under CI52, which is now Foundations of AI).
  const reused = scheme.items.find((c) => c.codeReusedBy.length > 0) ?? null;
  const moved =
    scheme.items.find((c) => reused && c.pastPapers.some((p) => p.code === reused.code)) ??
    scheme.items.find((c) => c.pastPapers.some((p) => p.code !== c.code)) ??
    null;

  return (
    <main>
      <Hero examples={EXAMPLES} />

      <section id="archive" className="section-sm" aria-label="Archive at a glance">
        <div className="shell">
          <div className="panel panel-pad">
            <div className="stats">
              <div className="stat">
                <div className="stat-value"><Counter value={stats.questions} /></div>
                <div className="stat-label">Questions indexed</div>
              </div>
              <div className="stat">
                <div className="stat-value"><Counter value={stats.documents} /></div>
                <div className="stat-label">Papers across {years.min}–{years.max}</div>
              </div>
              <div className="stat">
                <div className="stat-value"><Counter value={stats.courses} /></div>
                <div className="stat-label">Courses across {branches.length} shelves</div>
              </div>
              <div className="stat">
                <div className="stat-value"><Counter value={topics} /></div>
                <div className="stat-label">Concept topics tagged</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section defer-render" aria-labelledby="shelf-title">
        <div className="shell">
          <div className="row between wrap gap-16" style={{ alignItems: 'flex-end' }}>
            <div>
              <p className="eyebrow">Browse the stacks</p>
              <h2 id="shelf-title" style={{ marginTop: 12 }}>Pick a branch off the shelf</h2>
            </div>
            <Link href="/departments" className="btn btn-outline btn-sm">
              All branches <Icon name="arrowRight" size={16} />
            </Link>
          </div>
          <div style={{ marginTop: 28 }}>
            <Bookshelf branches={branches} />
          </div>
        </div>
      </section>

      <section className="section defer-render" aria-labelledby="features-title">
        <div className="shell">
          <div style={{ maxWidth: 640 }}>
            <p className="eyebrow">Why it is different</p>
            <h2 id="features-title" style={{ marginTop: 12 }}>
              Not another folder of Drive links
            </h2>
            <p className="lead" style={{ marginTop: 14 }}>
              Other collections point you at a folder and leave the reading to you. This one indexes
              the text of every question, so the archive can answer questions about itself.
            </p>
          </div>

          <div className="features" style={{ marginTop: 36 }}>
            {FEATURES.map((feature, i) => (
              <Tilt key={feature.title} max={5}>
                <div className="feature" style={{ position: 'relative', height: '100%' }}>
                  <div className="row between">
                    <span className="feature-icon"><Icon name={feature.icon} size={20} /></span>
                    <span className="feature-num">0{i + 1}</span>
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </div>
              </Tilt>
            ))}
          </div>
        </div>
      </section>

      <section className="section rule-top defer-render" aria-labelledby="example-title">
        <div className="shell">
          <div className="row between wrap gap-16" style={{ alignItems: 'flex-end' }}>
            <div style={{ maxWidth: 560 }}>
              <p className="eyebrow">Worked example</p>
              <h2 id="example-title" style={{ marginTop: 12 }}>A real query, against the live index</h2>
              <p className="lead" style={{ marginTop: 12 }}>
                None of these questions say &ldquo;least total edge cost&rdquo;. They are found by meaning.
              </p>
            </div>
            <Link href={`/search?q=${encodeURIComponent(demo.query.raw)}`} className="btn btn-outline btn-sm">
              Open this search <Icon name="arrowRight" size={16} />
            </Link>
          </div>

          <div className="panel panel-pad" style={{ marginTop: 24 }}>
            <div className="row gap-10 wrap">
              <span className="label">Query</span>
              <span className="mono">&ldquo;{demo.query.raw}&rdquo;</span>
            </div>

            <div className="interpret" style={{ marginTop: 16 }}>
              <span className="label" style={{ color: 'var(--accent)' }}>Interpreted as</span>
              {demo.query.understood.map((part) => (
                <span key={part} className="tag tag-accent">{part}</span>
              ))}
              <span className="tag">topic: {demo.query.text}</span>
              <span className="muted xs nums">
                {demo.total} matches · {demo.tookMs} ms
              </span>
            </div>

            <div className="divide" style={{ marginTop: 8 }}>
              {demo.hits.map((hit, i) => (
                <QuestionResult key={hit.id} hit={hit} rank={i + 1} terms={demo.query.text.split(' ')} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {moved && (
        <section className="section rule-top defer-render" aria-labelledby="scheme-title">
          <div className="shell">
            <div className="grid-2" style={{ gap: 48, alignItems: 'center' }}>
              <div>
                <p className="eyebrow">Syllabus revisions</p>
                <h2 id="scheme-title" style={{ marginTop: 12 }}>Course codes change. Topics don&rsquo;t.</h2>
                <p className="lead" style={{ marginTop: 14 }}>
                  Schemes rename subjects and reuse codes, so a search keyed on course codes breaks every few years.
                  Each current course is linked to past papers by subject, and questions are found by topic.
                </p>
                <div style={{ marginTop: 22 }}>
                  <Link href="/courses" className="btn btn-outline btn-sm">
                    See the current scheme <Icon name="arrowRight" size={16} />
                  </Link>
                </div>
              </div>

              <div className="panel panel-pad">
                <div className="row between wrap gap-12">
                  <div>
                    <span className="tag tag-code tag-accent">{moved.code}</span>
                    <p className="display" style={{ marginTop: 8, fontSize: 24 }}>{moved.title}</p>
                  </div>
                  <span className="tag">{moved.scheme} scheme</span>
                </div>

                <div className="stack gap-6" style={{ marginTop: 18 }}>
                  {moved.pastPapers.map((p) => (
                    <div key={`${p.code}-${p.title}`} className="diff-row diff-add">
                      <span className="diff-sign">←</span>
                      <span>
                        {p.code}: {p.title} · {p.papers} paper{p.papers === 1 ? '' : 's'}
                        {p.years.length ? ` (${p.years.join(', ')})` : ''}
                      </span>
                    </div>
                  ))}
                  {reused && (
                    <div className="diff-row diff-remove">
                      <span className="diff-sign">!</span>
                      <span>
                        {reused.code} is now {reused.title}; older {reused.code} papers are{' '}
                        {reused.codeReusedBy.map((r) => r.title).join(', ')}
                      </span>
                    </div>
                  )}
                </div>

                <p className="xs muted" style={{ marginTop: 14 }}>Linked by course-title similarity, not by code.</p>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="section rule-top defer-render" aria-labelledby="assistant-title">
        <div className="shell-narrow center">
          <p className="eyebrow" style={{ justifyContent: 'center' }}>Study assistant</p>
          <h2 id="assistant-title" style={{ marginTop: 12 }}>Ask the archive what to revise</h2>
          <p className="lead" style={{ marginTop: 14 }}>
            It ranks topics by how many papers examined them and cites the papers it used, with no
            language model involved. Good for &ldquo;what should I revise first for ML&rdquo;.
          </p>
          <div className="row gap-12 wrap" style={{ marginTop: 26, justifyContent: 'center' }}>
            <Link href="/assistant" className="btn btn-primary">
              <Icon name="message" size={17} /> Open the assistant
            </Link>
            <Link href="/about" className="btn btn-outline">How it works</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
