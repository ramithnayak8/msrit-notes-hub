import type { Metadata } from 'next';
import Link from 'next/link';
import { diffSyllabus, getSyllabusCourses, getSyllabusUnits } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Syllabus changes',
  description: 'Exactly which topics were added or removed between syllabus schemes, course by course.',
};

export default async function SyllabusPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  const { course } = await searchParams;
  const tracked = getSyllabusCourses();
  const selected = course ?? tracked[0]?.code;
  const diff = selected ? diffSyllabus(selected) : null;
  const currentUnits = diff ? getSyllabusUnits(diff.to.id) : [];

  return (
    <main>
      <section className="page-head">
        <div className="shell">
          <p className="eyebrow">Syllabus tracking</p>
          <h1>What changed between schemes</h1>
          <p className="lead">
            Each course stores its scheme per academic year. Comparing two years is a structural
            diff over unit topics, so additions and removals are exact rather than inferred.
          </p>

          <div className="row wrap gap-8" style={{ marginTop: 26 }}>
            {tracked.map((t) => (
              <Link
                key={t.code}
                href={`/syllabus?course=${t.code}`}
                className={`example${t.code === selected ? ' active' : ''}`}
                aria-current={t.code === selected ? 'page' : undefined}
              >
                {t.code} — {t.title}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section style={{ paddingBottom: 'var(--space-16)' }}>
        <div className="shell">
          {!diff && (
            <div className="empty">
              <p className="empty-title">No course has two tracked schemes yet</p>
            </div>
          )}

          {diff && (
            <>
              <div className="panel panel-pad">
                <div className="row between wrap gap-16" style={{ alignItems: 'flex-end' }}>
                  <div>
                    <div className="row gap-10">
                      <span className="tag tag-code tag-accent">{diff.courseCode}</span>
                      <Link href={`/courses/${diff.courseCode}`} className="small">
                        View papers →
                      </Link>
                    </div>
                    <h2 style={{ marginTop: 12, fontSize: 32 }}>{diff.courseTitle}</h2>
                  </div>
                  <div className="small muted" style={{ textAlign: 'right' }}>
                    <div>
                      {diff.from.academic_year} (from {diff.from.effective_from})
                    </div>
                    <div style={{ marginTop: 2 }}>
                      → {diff.to.academic_year} (from {diff.to.effective_from})
                    </div>
                  </div>
                </div>

                <div className="stats" style={{ marginTop: 26 }}>
                  <div className="stat">
                    <div className="stat-value" style={{ color: 'var(--positive)' }}>
                      {diff.added.length}
                    </div>
                    <div className="stat-label">Topics added</div>
                  </div>
                  <div className="stat">
                    <div className="stat-value" style={{ color: 'var(--negative)' }}>
                      {diff.removed.length}
                    </div>
                    <div className="stat-label">Topics removed</div>
                  </div>
                  <div className="stat">
                    <div className="stat-value">{diff.unchangedCount}</div>
                    <div className="stat-label">Unchanged</div>
                  </div>
                  <div className="stat">
                    <div className="stat-value">{diff.newUnits.length}</div>
                    <div className="stat-label">New units</div>
                  </div>
                </div>
              </div>

              <div className="grid-2" style={{ marginTop: 28, gap: 28 }}>
                <div>
                  <h3>Added in {diff.to.academic_year}</h3>
                  <div className="stack gap-8" style={{ marginTop: 14 }}>
                    {diff.added.length ? (
                      diff.added.map((a) => (
                        <div key={`a-${a.unit}-${a.topic}`} className="diff-row diff-add">
                          <span className="diff-sign">+</span>
                          <span>
                            <strong style={{ fontWeight: 600 }}>Unit {a.unit}</strong> — {a.topic}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="small muted">Nothing added.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3>Removed since {diff.from.academic_year}</h3>
                  <div className="stack gap-8" style={{ marginTop: 14 }}>
                    {diff.removed.length ? (
                      diff.removed.map((r) => (
                        <div key={`r-${r.unit}-${r.topic}`} className="diff-row diff-remove">
                          <span className="diff-sign">−</span>
                          <span>
                            <strong style={{ fontWeight: 600 }}>Unit {r.unit}</strong> — {r.topic}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="small muted">Nothing removed.</p>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 44 }}>
                <h3>
                  Current scheme — {diff.to.academic_year}
                </h3>
                <div className="panel" style={{ marginTop: 14 }}>
                  <div className="divide">
                    {currentUnits.map((unit) => {
                      const addedInUnit = new Set(
                        diff.added.filter((a) => a.unit === unit.unit).map((a) => a.topic)
                      );
                      return (
                        <div key={unit.unit} style={{ padding: '18px 22px' }}>
                          <div className="row between wrap gap-10" style={{ alignItems: 'baseline' }}>
                            <h4>
                              Unit {unit.unit} — {unit.unitTitle}
                            </h4>
                            <span className="xs muted nums">{unit.hours} hours</span>
                          </div>
                          <div className="row wrap gap-6" style={{ marginTop: 10 }}>
                            {unit.topics.map((t) => (
                              <span
                                key={t}
                                className={`tag${addedInUnit.has(t) ? ' tag-positive' : ''}`}
                              >
                                {addedInUnit.has(t) && <span className="diff-sign">+</span>}
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <p className="notice" style={{ marginTop: 28 }}>
                Topics that survived the revision are the safest place to start revising — questions
                from older papers on those topics are still in scope. {diff.unchangedCount} topics
                carried over unchanged in this course.
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
