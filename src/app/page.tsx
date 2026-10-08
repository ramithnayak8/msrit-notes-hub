import Link from 'next/link';
import { Hero } from '@/components/hero/Hero';
import { QuestionResult } from '@/components/QuestionResult';
import { Bookshelf } from '@/components/browse/Bookshelf';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Tilt } from '@/components/ui/Tilt';
import { Counter } from '@/components/ui/Counter';
import { getStats, getDepartments, diffSyllabus, getLibraryStats, getLibraryByYear, searchQuestions } from '@/lib/data';

export const dynamic = 'force-dynamic';

const EXAMPLES = [
  'binary tree questions from the last 3 years',
  'deadlock questions from CS501',
  'normalization worth 10 marks',
  'graph shortest path 2023',
];

const FEATURES: { icon: IconName; title: string; body: React.ReactNode }[] = [
  {
    icon: 'search',
    title: 'Search by what a question is about',
    body: (
      <>
        Queries are expanded with term associations mined from the papers themselves, so
        &ldquo;multithreading&rdquo; still finds a question that only says &ldquo;thread&rdquo;.
      </>
    ),
  },
  {
    icon: 'sparkles',
    title: 'Ask in plain English',
    body: (
      <>
        &ldquo;Last 3 years&rdquo;, &ldquo;10 marks&rdquo; and &ldquo;from CS501&rdquo; become real
        filters, and every search shows you exactly how it read your request.
      </>
    ),
  },
  {
    icon: 'diff',
    title: 'Know what changed in the syllabus',
    body: (
      <>
        Each course keeps its scheme per academic year, so you can see which topics were added,
        dropped or reworded before you revise the wrong unit.
      </>
    ),
  },
];

export default async function HomePage() {
  const [stats, library, byYear, departments, demo, diff] = await Promise.all([
    getStats(),
    getLibraryStats(),
    getLibraryByYear(),
    getDepartments(),
    searchQuestions('binary tree questions from the last 3 years', 2),
    diffSyllabus('CS501'),
  ]);

  return (
    <main>
      <Hero examples={EXAMPLES} paperCount={library.papers} />

      <section id="archive" className="section-sm" aria-label="Archive at a glance">
        <div className="shell">
          <div className="panel panel-pad">
            <div className="stats">
              <Link href="/papers" className="stat stat-link">
                <div className="stat-value"><Counter value={library.papers} /></div>
                <div className="stat-label">Past papers in the library</div>
              </Link>
              <Link href="/papers" className="stat stat-link">
                <div className="stat-value"><Counter value={library.subjects} /></div>
                <div className="stat-label">Subjects, first to fourth year</div>
              </Link>
              <Link href="/search" className="stat stat-link">
                <div className="stat-value"><Counter value={stats.questions} /></div>
                <div className="stat-label">Questions searchable by topic</div>
              </Link>
              <Link href="/departments" className="stat stat-link">
                <div className="stat-value"><Counter value={stats.departments} /></div>
                <div className="stat-label">Branches on the shelf</div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section-sm" aria-labelledby="years-title">
        <div className="shell">
          <div className="row between wrap gap-16" style={{ alignItems: 'flex-end' }}>
            <div>
              <p className="eyebrow">Past papers library</p>
              <h2 id="years-title" style={{ marginTop: 12 }}>Start from your year</h2>
            </div>
            <Link href="/papers" className="btn btn-outline btn-sm">
              Open the library <Icon name="arrowRight" size={16} />
            </Link>
          </div>
          <div className="year-volumes" style={{ marginTop: 28 }}>
            {byYear.map((y) => (
              <Link key={y.year} href={`/papers?year=${y.year}`} className="year-volume" data-year={y.year}>
                <span className="year-volume-num" aria-hidden>{['I', 'II', 'III', 'IV'][y.year - 1]}</span>
                <span className="year-volume-title">{['First', 'Second', 'Third', 'Fourth'][y.year - 1]} year</span>
                <span className="year-volume-count nums">{y.papers.toLocaleString('en-IN')} papers · {y.subjects} subjects</span>
                <span className="year-volume-topics">{y.top.join(' · ')}</span>
                <span className="year-volume-go" aria-hidden><Icon name="arrowRight" size={18} /></span>
              </Link>
            ))}
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
            <Bookshelf departments={departments} />
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
              {demo.query.explanation.map((part) => (
                <span key={part} className="tag tag-accent">{part}</span>
              ))}
              <span className="muted xs nums">
                {demo.total} matches · {demo.tookMs} ms
              </span>
            </div>

            <div className="divide" style={{ marginTop: 8 }}>
              {demo.hits.map((hit, i) => (
                <QuestionResult key={hit.id} hit={hit} rank={i + 1} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {diff && (
        <section className="section rule-top defer-render" aria-labelledby="syllabus-title">
          <div className="shell">
            <div className="grid-2" style={{ gap: 48, alignItems: 'center' }}>
              <div>
                <p className="eyebrow">Syllabus tracking</p>
                <h2 id="syllabus-title" style={{ marginTop: 12 }}>Know what changed before you revise</h2>
                <p className="lead" style={{ marginTop: 14 }}>
                  The archive stores each course scheme by academic year. Comparing two years is a
                  structural diff, not guesswork, so additions and removals are exact.
                </p>
                <div style={{ marginTop: 22 }}>
                  <Link href="/syllabus" className="btn btn-outline btn-sm">
                    View all tracked changes <Icon name="arrowRight" size={16} />
                  </Link>
                </div>
              </div>

              <div className="panel panel-pad">
                <div className="row between wrap gap-12">
                  <div>
                    <span className="tag tag-code tag-accent">{diff.courseCode}</span>
                    <p className="display" style={{ marginTop: 8, fontSize: 24 }}>{diff.courseTitle}</p>
                  </div>
                  <span className="tag">
                    {diff.from.academic_year} → {diff.to.academic_year}
                  </span>
                </div>

                <div className="stack gap-6" style={{ marginTop: 18 }}>
                  {diff.added.slice(0, 3).map((a) => (
                    <div key={`a-${a.unit}-${a.topic}`} className="diff-row diff-add">
                      <span className="diff-sign">+</span>
                      <span>Unit {a.unit}: {a.topic}</span>
                    </div>
                  ))}
                  {diff.removed.slice(0, 2).map((r) => (
                    <div key={`r-${r.unit}-${r.topic}`} className="diff-row diff-remove">
                      <span className="diff-sign">−</span>
                      <span>Unit {r.unit}: {r.topic}</span>
                    </div>
                  ))}
                </div>

                <p className="xs muted" style={{ marginTop: 14 }}>
                  {diff.added.length} added · {diff.removed.length} removed · {diff.unchangedCount} unchanged
                </p>
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
            The assistant answers only from retrieved questions and syllabus schemes, and cites the
            papers it used. Good for &ldquo;what should I revise first&rdquo; and &ldquo;what changed
            this year&rdquo;.
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
