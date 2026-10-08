import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { BookmarkButton, RecordVisit, SaveCourseButton } from '@/components/study/ShelfButtons';
import { apiGetOrNull, paperFileUrl, type CourseDetail, type CoursePaper } from '@/lib/api';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ code: string }> };

const getCourse = (code: string) => apiGetOrNull<CourseDetail>(`/course/${encodeURIComponent(code.toUpperCase())}`);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const course = await getCourse((await params).code);
  return course
    ? { title: `${course.title} (${course.code})`, description: `Previous year questions for ${course.title}, split by paper and tagged by topic.` }
    : { title: 'Course not found' };
}

const paperName = (p: CoursePaper) => [p.examType, [p.month, p.year].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || p.title;

export default async function CoursePage({ params }: Params) {
  const course = await getCourse((await params).code);
  if (!course) notFound();

  const questions = course.papers.flatMap((p) => p.questions);
  const branch = course.papers.find((p) => p.branch)?.branch ?? 'COMMON';
  const semester = course.official?.semester ?? course.papers.find((p) => p.semester)?.semester ?? 0;
  const courseRef = { code: course.code, title: course.title, dept: branch, semester };
  const repeated = questions.filter((q) => q.askedIn > 1).length;
  const otherCodes = [...new Set(course.papers.map((p) => p.courseCode).filter((c) => c && c !== course.code))];

  return (
    <main>
      <RecordVisit course={courseRef} />
      <section className="page-head" style={{ paddingBottom: 'var(--space-6)' }}>
        <div className="shell">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href="/departments">Branches</Link>
            <span aria-hidden>/</span>
            <Link href={`/departments/${branch}`}>{branch === 'COMMON' ? 'All branches' : branch}</Link>
            <span aria-hidden>/</span>
            <span aria-current="page">{course.code}</span>
          </nav>

          <div className="row between wrap gap-20" style={{ marginTop: 16, alignItems: 'flex-end' }}>
            <div>
              <div className="row gap-10 wrap">
                <span className="tag tag-code tag-accent">{course.code}</span>
                <span className="small muted">
                  {semester ? `Semester ${semester} · ` : ''}
                  {course.official ? `${course.official.scheme} scheme` : 'from past papers'}
                </span>
              </div>
              <h1 style={{ marginTop: 12 }}>{course.title}</h1>
            </div>
            <div className="row gap-10 wrap">
              <SaveCourseButton course={courseRef} />
              <Link href={`/assistant?q=${encodeURIComponent(`what should I revise for ${course.code}`)}`} className="btn btn-outline btn-sm">
                <Icon name="message" size={16} /> What to revise
              </Link>
              <Link href={`/search?q=${encodeURIComponent(course.code)}`} className="btn btn-primary btn-sm">
                <Icon name="search" size={16} /> Search this course
              </Link>
            </div>
          </div>

          {otherCodes.length > 0 && (
            <p className="notice" style={{ marginTop: 20 }}>
              The current <strong>{course.code}</strong> has no papers of its own yet. These are past papers on the same
              subject, set under {otherCodes.join(', ')} in older schemes, matched by course title.
            </p>
          )}
          {course.codeReused && (
            <p className="notice" style={{ marginTop: 20, borderLeftColor: 'var(--amber, #d9a441)' }}>
              In the current scheme <strong>{course.code}</strong> is {course.title}, but the papers below were set under the
              same code for a different subject in an older scheme. This is why the archive searches by topic, not code.
            </p>
          )}
        </div>
      </section>

      <section style={{ padding: 'var(--space-8) 0 var(--space-16)' }}>
        <div className="shell course-layout">
          <div id="papers" className="stack gap-32">
            {course.papers.map((paper) => (
              <section key={paper.id} aria-labelledby={`paper-${paper.id}`}>
                <div className="row between wrap gap-12" style={{ alignItems: 'baseline' }}>
                  <h2 id={`paper-${paper.id}`} style={{ fontSize: 26 }}>
                    {paperName(paper)}
                    {paper.courseCode && paper.courseCode !== course.code && <span className="small muted"> · {paper.courseCode}</span>}
                  </h2>
                  <span className="row gap-12 xs muted nums">
                    <span>
                      {paper.questions.length} question{paper.questions.length === 1 ? '' : 's'}
                      {paper.textSource === 'ocr' ? ' · scanned' : ''}
                    </span>
                    <a href={paperFileUrl(paper.id)} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Icon name="file" size={13} /> Open PDF
                    </a>
                  </span>
                </div>

                <div className="panel" style={{ marginTop: 12 }}>
                  <div className="divide">
                    {paper.questions.map((q) => (
                      <article key={q.id} id={`q-${q.id}`} className="question-card">
                        <div className="row between wrap gap-10" style={{ alignItems: 'baseline' }}>
                          <span className="result-cite">{q.label}</span>
                          <span className="row gap-10">
                            <span className="xs muted">
                              {[q.marks !== null && `${q.marks} marks`, q.unit && `Unit ${q.unit}`, q.co, q.bloom].filter(Boolean).join(' · ')}
                            </span>
                            {q.askedIn > 1 && <span className="tag tag-amber xs">Asked in {q.askedIn} papers</span>}
                            <BookmarkButton
                              question={{
                                id: q.id,
                                number: q.label.replace(/^Q/, ''),
                                text: q.text,
                                marks: q.marks ?? 0,
                                courseCode: course.code,
                                courseTitle: course.title,
                                paper: paperName(paper),
                              }}
                            />
                          </span>
                        </div>
                        <p className="reading" style={{ marginTop: 10 }}>{q.text}</p>
                        {q.topics.length > 0 && (
                          <div className="row wrap gap-6" style={{ marginTop: 12 }}>
                            {q.topics.map((t) => (
                              <Link key={t.name} href={`/search?q=${encodeURIComponent(t.label)}`} className="tag">
                                {t.label}
                              </Link>
                            ))}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              </section>
            ))}

            {!course.papers.length && (
              <div className="empty">
                <p className="empty-title">No papers on this shelf yet</p>
                <p className="small" style={{ marginTop: 8 }}>
                  Nothing has been indexed for this course. <Link href="/upload">Upload a paper</Link>.
                </p>
              </div>
            )}
          </div>

          <aside className="stack gap-24 course-aside">
            <div className="panel panel-pad">
              <div className="label">At a glance</div>
              <div className="stack gap-10" style={{ marginTop: 14 }}>
                {[
                  ['Papers', course.papers.length],
                  ['Questions', questions.length],
                  ['Asked again elsewhere', repeated],
                  ['Topics', course.topics.length],
                ].map(([label, value]) => (
                  <div key={label} className="row between small">
                    <span className="muted">{label}</span>
                    <span className="nums">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div id="topics" className="panel panel-pad">
              <div className="label">Most examined topics</div>
              {course.topics.length > 0 ? (
                <div className="stack gap-6" style={{ marginTop: 14 }}>
                  {course.topics.map((t) => (
                    <Link key={t.name} href={`/search?q=${encodeURIComponent(`${t.label} ${course.code}`)}`} className="topic-row">
                      <span>{t.label}</span>
                      <span className="muted nums xs" title={`${t.papers} papers, ${t.questions} questions`}>
                        {t.papers}/{course.papers.length}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="small muted" style={{ marginTop: 10 }}>No topics tagged yet.</p>
              )}
              <p className="xs muted" style={{ marginTop: 12 }}>Number of papers that examined each topic.</p>
            </div>

            {course.official && course.official.linked.length > 0 && (
              <div className="panel panel-pad">
                <div className="label">Same subject, older codes</div>
                <div className="stack gap-8" style={{ marginTop: 14 }}>
                  {course.official.linked.map((l) => (
                    <Link key={`${l.code}-${l.title}`} href={`/courses/${l.code}`} className="row between gap-10 small">
                      <span className="soft">{l.code} · {l.title}</span>
                      <span className="muted xs nums" title="Title similarity">{Math.round(l.similarity * 100)}%</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}
