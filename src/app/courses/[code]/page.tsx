import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import {
  getCourse,
  getDepartment,
  getNotesByCourse,
  getPapersByCourse,
  getQuestionsByCourse,
  getSyllabusVersions,
} from '@/lib/db';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const course = getCourse((await params).code);
  return course
    ? {
        title: `${course.title} (${course.code})`,
        description: `Previous year questions, notes and syllabus for ${course.title}, semester ${course.semester}.`,
      }
    : { title: 'Course not found' };
}

export default async function CoursePage({ params }: Params) {
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
      <section className="page-head" style={{ paddingBottom: 'var(--space-6)' }}>
        <div className="shell">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href="/departments">Branches</Link>
            <span aria-hidden>/</span>
            <Link href={`/departments/${course.dept_code}`}>{course.dept_code}</Link>
            <span aria-hidden>/</span>
            <span aria-current="page">{course.code}</span>
          </nav>

          <div className="row between wrap gap-20" style={{ marginTop: 16, alignItems: 'flex-end' }}>
            <div>
              <div className="row gap-10 wrap">
                <span className="tag tag-code tag-accent">{course.code}</span>
                <span className="small muted">
                  Semester {course.semester} · {course.credits} credits · {department?.name ?? course.dept_code}
                </span>
              </div>
              <h1 style={{ marginTop: 12 }}>{course.title}</h1>
            </div>
            <div className="row gap-10 wrap">
              {schemes.length >= 2 && (
                <Link href={`/syllabus?course=${course.code}`} className="btn btn-outline btn-sm">
                  <Icon name="diff" size={16} /> Syllabus changes
                </Link>
              )}
              <Link href={`/search?q=${encodeURIComponent(course.code)}`} className="btn btn-primary btn-sm">
                <Icon name="search" size={16} /> Search this course
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="shell">
        <nav className="section-nav" aria-label="On this page">
          <a href="#papers" className="example">Papers · {papers.length}</a>
          <a href="#topics" className="example">Most examined topics</a>
          <a href="#notes" className="example">Notes · {notes.length}</a>
          {schemes.length >= 2 && (
            <Link href={`/syllabus?course=${course.code}`} className="example">Syllabus · {schemes.length} schemes</Link>
          )}
        </nav>
      </div>

      <section style={{ padding: 'var(--space-8) 0 var(--space-16)' }}>
        <div className="shell course-layout">
          <div id="papers" className="stack gap-32" style={{ scrollMarginTop: 'calc(var(--masthead-h) + 70px)' }}>
            {papers.map((paper) => {
              const paperQuestions = byPaper.get(paper.id) ?? [];
              return (
                <section key={paper.id} aria-labelledby={`paper-${paper.id}`}>
                  <div className="row between wrap gap-12" style={{ alignItems: 'baseline' }}>
                    <h2 id={`paper-${paper.id}`} style={{ fontSize: 26 }}>
                      {paper.exam_type} · {paper.month} {paper.year}
                    </h2>
                    <span className="xs muted nums">
                      {paperQuestions.length} question{paperQuestions.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="panel" style={{ marginTop: 12 }}>
                    <div className="divide">
                      {paperQuestions.map((q) => (
                        <article key={q.id} id={`q-${q.id}`} className="question-card">
                          <div className="row between wrap gap-10" style={{ alignItems: 'baseline' }}>
                            <span className="result-cite">Q{q.number}</span>
                            <span className="xs muted">
                              {q.marks} marks · Unit {q.unit} · {q.level}
                            </span>
                          </div>
                          <p className="reading" style={{ marginTop: 10 }}>{q.text}</p>
                          <div className="row wrap gap-6" style={{ marginTop: 12 }}>
                            {q.topics.split('|').filter(Boolean).map((t) => (
                              <span key={t} className="tag">{t}</span>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                </section>
              );
            })}

            {!papers.length && (
              <div className="empty">
                <p className="empty-title">No papers on this shelf yet</p>
                <p className="small" style={{ marginTop: 8 }}>No papers have been indexed for this course.</p>
              </div>
            )}
          </div>

          <aside className="stack gap-24 course-aside">
            <div className="panel panel-pad">
              <div className="label">At a glance</div>
              <div className="stack gap-10" style={{ marginTop: 14 }}>
                {[
                  ['Papers', papers.length],
                  ['Questions', questions.length],
                  ['Note sets', notes.length],
                  ['Schemes tracked', schemes.length],
                ].map(([label, value]) => (
                  <div key={label} className="row between small">
                    <span className="muted">{label}</span>
                    <span className="nums">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div id="topics" className="panel panel-pad" style={{ scrollMarginTop: 'calc(var(--masthead-h) + 70px)' }}>
              <div className="label">Most examined topics</div>
              {topTopics.length > 0 ? (
                <div className="stack gap-6" style={{ marginTop: 14 }}>
                  {topTopics.map(([topic, count]) => (
                    <Link
                      key={topic}
                      href={`/search?q=${encodeURIComponent(`${topic} ${course.code}`)}`}
                      className="topic-row"
                    >
                      <span>{topic}</span>
                      <span className="muted nums xs">{count}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="small muted" style={{ marginTop: 10 }}>No topics tagged yet.</p>
              )}
            </div>

            <div id="notes" className="panel panel-pad" style={{ scrollMarginTop: 'calc(var(--masthead-h) + 70px)' }}>
              <div className="label">Notes</div>
              {notes.length > 0 ? (
                <div className="stack gap-12" style={{ marginTop: 14 }}>
                  {notes.map((n) => (
                    <div key={n.id} className="row-top gap-10">
                      <span className="muted" style={{ marginTop: 2 }}><Icon name="file" size={16} /></span>
                      <div>
                        <p className="small" style={{ fontWeight: 600 }}>{n.title}</p>
                        <p className="xs muted" style={{ marginTop: 2 }}>
                          {n.kind} · {n.pages} pages · {n.contributor} · {n.year}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="small muted" style={{ marginTop: 10 }}>
                  No notes yet. <Link href="/about#contribute">Contribute a set</Link>.
                </p>
              )}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
