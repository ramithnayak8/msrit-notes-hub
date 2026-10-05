import Link from 'next/link';
import { Hero } from '@/components/hero/Hero';
import { QuestionResult } from '@/components/QuestionResult';
import { getStats, getYearRange, getDepartments, diffSyllabus } from '@/lib/db';
import { searchQuestions } from '@/lib/search';

export const dynamic = 'force-dynamic';

const EXAMPLES = [
  'binary tree questions from the last 3 years',
  'deadlock questions from CS501',
  'normalization worth 10 marks',
  'graph shortest path 2023',
];

export default function HomePage() {
  const stats = getStats();
  const years = getYearRange();
  const departments = getDepartments().filter((d) => d.question_count > 0).slice(0, 6);
  const demo = searchQuestions('binary tree questions from the last 3 years', 2);
  const diff = diffSyllabus('CS501');

  return (
    <main>
      <Hero examples={EXAMPLES} />

      {/* Statistics */}
      <section id="archive" style={{ padding: '48px 0 40px' }}>
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

      {/* Differentiators */}
      <section className="section defer-render">
        <div className="shell">
          <div style={{ maxWidth: 640 }}>
            <h2>Built differently from a spreadsheet of Drive links</h2>
            <p className="lead" style={{ marginTop: 14 }}>
              Existing collections point you at a folder and leave the reading to you. This one
              indexes the text of every question, so the archive can answer questions about itself.
            </p>
          </div>

          <div className="features" style={{ marginTop: 36 }}>
            <div className="feature">
              <div className="feature-num">01</div>
              <h3>Semantic search over paper contents</h3>
              <p>
                Queries are expanded using term associations mined from the corpus, so a search for
                &ldquo;multithreading&rdquo; still reaches a question that only says
                &ldquo;thread&rdquo;. Ranking is BM25 over weighted fields.
              </p>
            </div>
            <div className="feature">
              <div className="feature-num">02</div>
              <h3>Plain English filters</h3>
              <p>
                &ldquo;Last 3 years&rdquo;, &ldquo;10 marks&rdquo;, &ldquo;from CS501&rdquo; and
                branch names are parsed out of the query and applied as real filters — the page
                shows you exactly how it read your request.
              </p>
            </div>
            <div className="feature">
              <div className="feature-num">03</div>
              <h3>Syllabus schemes tracked over time</h3>
              <p>
                Each course keeps its scheme per academic year, so the archive can show precisely
                which topics were added, dropped or reworded before you revise the wrong unit.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Worked example */}
      <section className="section rule-top defer-render">
        <div className="shell">
          <div className="row between wrap gap-16" style={{ alignItems: 'flex-end' }}>
            <div style={{ maxWidth: 560 }}>
              <div className="label">Worked example</div>
              <h2 style={{ marginTop: 12 }}>A real query, against the live index</h2>
            </div>
            <Link href={`/search?q=${encodeURIComponent(demo.query.raw)}`} className="btn btn-outline btn-sm">
              Open this search
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

      {/* Syllabus change */}
      {diff && (
        <section className="section rule-top defer-render">
          <div className="shell">
            <div className="grid-2" style={{ gap: 48, alignItems: 'start' }}>
              <div>
                <div className="label">Syllabus tracking</div>
                <h2 style={{ marginTop: 12 }}>Know what changed before you revise</h2>
                <p className="lead" style={{ marginTop: 14 }}>
                  The archive stores each course scheme by academic year. Comparing two years is a
                  structural diff, not guesswork — so you can see the additions and removals
                  directly.
                </p>
                <div style={{ marginTop: 20 }}>
                  <Link href="/syllabus" className="btn btn-outline btn-sm">
                    View all tracked changes
                  </Link>
                </div>
              </div>

              <div className="panel panel-pad">
                <div className="row between wrap gap-12">
                  <div>
                    <h3 className="mono" style={{ fontSize: 15 }}>{diff.courseCode}</h3>
                    <p className="small muted" style={{ marginTop: 2 }}>{diff.courseTitle}</p>
                  </div>
                  <span className="tag">
                    {diff.from.academic_year} → {diff.to.academic_year}
                  </span>
                </div>

                <div className="stack gap-6" style={{ marginTop: 18 }}>
                  {diff.added.slice(0, 3).map((a) => (
                    <div key={`a-${a.unit}-${a.topic}`} className="diff-row diff-add">
                      <span className="diff-sign">+</span>
                      <span>Unit {a.unit} — {a.topic}</span>
                    </div>
                  ))}
                  {diff.removed.slice(0, 2).map((r) => (
                    <div key={`r-${r.unit}-${r.topic}`} className="diff-row diff-remove">
                      <span className="diff-sign">−</span>
                      <span>Unit {r.unit} — {r.topic}</span>
                    </div>
                  ))}
                </div>

                <p className="xs muted" style={{ marginTop: 14 }}>
                  {diff.added.length} added · {diff.removed.length} removed ·{' '}
                  {diff.unchangedCount} unchanged
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Branches */}
      <section className="section rule-top defer-render">
        <div className="shell">
          <div className="row between wrap gap-16" style={{ alignItems: 'flex-end' }}>
            <div>
              <div className="label">Coverage</div>
              <h2 style={{ marginTop: 12 }}>Browse by branch</h2>
            </div>
            <Link href="/departments" className="btn btn-outline btn-sm">
              All branches
            </Link>
          </div>

          <div className="grid-3" style={{ marginTop: 26 }}>
            {departments.map((d) => (
              <Link key={d.code} href={`/departments/${d.code}`} className="panel panel-pad card-link">
                <div className="row between">
                  <span className="tag tag-code tag-accent">{d.code}</span>
                  <span className="xs muted nums">{d.course_count} courses</span>
                </div>
                <h3 style={{ marginTop: 14, fontSize: 17 }}>{d.name}</h3>
                <p className="small muted" style={{ marginTop: 4 }}>{d.full_name}</p>
                <p className="small soft nums" style={{ marginTop: 14 }}>
                  {d.question_count} questions · {d.paper_count} papers · {d.note_count} note sets
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Assistant */}
      <section className="section rule-top defer-render">
        <div className="shell-narrow center">
          <div className="label">Study assistant</div>
          <h2 style={{ marginTop: 12 }}>Ask the archive what to revise</h2>
          <p className="lead" style={{ marginTop: 14 }}>
            The assistant answers from retrieved questions and syllabus schemes only, and cites the
            papers it used. Useful for &ldquo;what should I revise first&rdquo; and &ldquo;what
            changed this year&rdquo; questions.
          </p>
          <div className="row gap-12" style={{ marginTop: 24, justifyContent: 'center' }}>
            <Link href="/assistant" className="btn btn-primary">Open the assistant</Link>
            <Link href="/about" className="btn btn-outline">How it works</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
