import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getCourse,
  getDepartment,
  getNotesByCourse,
  getPapersByCourse,
  getQuestionsByCourse,
  getSyllabusVersions,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function CoursePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const course = getCourse(code);
  if (!course) notFound();

  const department = getDepartment(course.dept_code);
  const papers = getPapersByCourse(course.code);
  const questions = getQuestionsByCourse(course.code);
  const notes = getNotesByCourse(course.code);
  const schemes = getSyllabusVersions(course.code);

  const byPaper = new Map<number, typeof questions>();
  for (const q of questions) {
    if (!byPaper.has(q.paper_id)) byPaper.set(q.paper_id, []);
    byPaper.get(q.paper_id)!.push(q);
  }

  const topicCount = new Map<string, number>();
  for (const q of questions) {
    for (const t of q.topics.split('|').filter(Boolean)) {
      topicCount.set(t, (topicCount.get(t) ?? 0) + 1);
    }
  }
  const topTopics = [...topicCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <main>
      <section className="section-sm">
        <div className="shell">
          <p className="small muted">
            <Link href="/departments">Branches</Link> <span className="muted">/</span>{' '}
            <Link href={`/departments/${course.dept_code}`}>{course.dept_code}</Link>{' '}
            <span className="muted">/</span> {course.code}
          </p>

          <div className="row between wrap gap-20" style={{ marginTop: 16, alignItems: 'flex-end' }}>
            <div>
              <div className="row gap-10">
                <span className="tag tag-code tag-accent">{course.code}</span>
                <span className="small muted">
                  Semester {course.semester} · {course.credits} credits ·{' '}
                  {department?.name ?? course.dept_code}
                </span>
              </div>
              <h1 style={{ marginTop: 12 }}>{course.title}</h1>
            </div>
            <div className="row gap-10">
              {schemes.length >= 2 && (
                <Link href={`/syllabus?course=${course.code}`} className="btn btn-outline btn-sm">
                  Syllabus changes
                </Link>
              )}
              <Link
                href={`/search?q=${encodeURIComponent(course.code)}`}
                className="btn btn-primary btn-sm"
              >
                Search this course
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section style={{ paddingBottom: 72 }}>
        <div className="shell">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 280px',
              gap: 48,
              alignItems: 'start',
            }}
            className="course-layout"
          >
            <div className="stack gap-32">
              {papers.map((paper) => {
                const paperQuestions = byPaper.get(paper.id) ?? [];
                return (
                  <div key={paper.id}>
                    <div className="row between wrap gap-12" style={{ alignItems: 'baseline' }}>
                      <h3 style={{ fontSize: 17 }}>
                        {paper.exam_type} · {paper.month} {paper.year}
                      </h3>
                      <span className="xs muted nums">
                        {paperQuestions.length} question{paperQuestions.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div className="panel" style={{ marginTop: 12 }}>
                      <div className="divide">
                        {paperQuestions.map((q) => (
                          <div key={q.id} style={{ padding: '16px 20px' }}>
                            <div className="row between wrap gap-10" style={{ alignItems: 'baseline' }}>
                              <span className="result-cite">Q{q.number}</span>
                              <span className="xs muted">
                                {q.marks} marks · Unit {q.unit} · {q.level}
                              </span>
                            </div>
                            <p className="serif" style={{ marginTop: 8, fontSize: 15.5, lineHeight: 1.6 }}>
                              {q.text}
                            </p>
                            <div className="row wrap gap-6" style={{ marginTop: 10 }}>
                              {q.topics.split('|').filter(Boolean).map((t) => (
                                <span key={t} className="tag">{t}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}

              {!papers.length && (
                <div className="empty">
                  <p>No papers have been indexed for this course yet.</p>
                </div>
              )}
            </div>

            <aside className="stack gap-24" style={{ position: 'sticky', top: 86 }}>
              <div className="panel panel-pad">
                <div className="label">At a glance</div>
                <div className="stack gap-10" style={{ marginTop: 14 }}>
                  <div className="row between small">
                    <span className="muted">Papers</span>
                    <span className="nums">{papers.length}</span>
                  </div>
                  <div className="row between small">
                    <span className="muted">Questions</span>
                    <span className="nums">{questions.length}</span>
                  </div>
                  <div className="row between small">
                    <span className="muted">Note sets</span>
                    <span className="nums">{notes.length}</span>
                  </div>
                  <div className="row between small">
                    <span className="muted">Schemes tracked</span>
                    <span className="nums">{schemes.length}</span>
                  </div>
                </div>
              </div>

              {topTopics.length > 0 && (
                <div className="panel panel-pad">
                  <div className="label">Most examined topics</div>
                  <div className="stack gap-8" style={{ marginTop: 14 }}>
                    {topTopics.map(([topic, count]) => (
                      <Link
                        key={topic}
                        href={`/search?q=${encodeURIComponent(`${topic} ${course.code}`)}`}
                        className="row between gap-10 small"
                        style={{ color: 'inherit' }}
                      >
                        <span className="soft">{topic}</span>
                        <span className="muted nums xs">{count}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {notes.length > 0 && (
                <div className="panel panel-pad">
                  <div className="label">Notes</div>
                  <div className="stack gap-12" style={{ marginTop: 14 }}>
                    {notes.map((n) => (
                      <div key={n.id}>
                        <p className="small" style={{ fontWeight: 500 }}>{n.title}</p>
                        <p className="xs muted" style={{ marginTop: 2 }}>
                          {n.kind} · {n.pages} pages · {n.contributor} · {n.year}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 900px) {
          .course-layout { grid-template-columns: minmax(0, 1fr) !important; gap: 32px !important; }
          .course-layout aside { position: static !important; }
        }
      `}</style>
    </main>
  );
}
