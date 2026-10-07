import Link from 'next/link';
import { Hero } from '@/components/hero/Hero';
import { QuestionResult } from '@/components/QuestionResult';
import { Bookshelf } from '@/components/browse/Bookshelf';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Tilt } from '@/components/ui/Tilt';
import { getStats, getYearRange, getDepartments, diffSyllabus } from '@/lib/db';
import { searchQuestions } from '@/lib/search';

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

export default function HomePage() {
  const stats = getStats();
  const years = getYearRange();
  const departments = getDepartments();
  const demo = searchQuestions('binary tree questions from the last 3 years', 2);
  const diff = diffSyllabus('CS501');

  return (
    <main>
      <Hero examples={EXAMPLES} />

      <section id="archive" className="section-sm" aria-label="Archive at a glance">
        <div className="shell">
          <div className="panel panel-pad">
            <div className="stats">
              <div className="stat">
                <div className="stat-value">{stats.questions}</div>
                <div className="stat-label">Questions indexed</div>
              </div>
              <div className="stat">
                <div className="stat-value">{stats.papers}</div>
                <div className="stat-label">Papers across {years.min}–{years.max}</div>
              </div>
              <div className="stat">
                <div className="stat-value">{stats.courses}</div>
                <div className="stat-label">Courses across {stats.departments} branches</div>
              </div>
              <div className="stat">
                <div className="stat-value">{stats.notes}</div>
                <div className="stat-label">Note sets contributed</div>
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
