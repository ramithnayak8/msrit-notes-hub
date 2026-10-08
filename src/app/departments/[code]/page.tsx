import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CourseBook } from '@/components/browse/CourseBook';
import { Icon } from '@/components/ui/Icon';
import { getCoursesByDept, getDepartment } from '@/lib/data';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const department = await getDepartment((await params).code);
  return department
    ? {
        title: department.full_name,
        description: `Previous year papers, notes and syllabus schemes for ${department.full_name}, semester by semester.`,
      }
    : { title: 'Branch not found' };
}

export default async function DepartmentPage({ params }: Params) {
  const { code } = await params;
  const department = await getDepartment(code);
  if (!department) notFound();

  const courses = await getCoursesByDept(code);
  const bySemester = new Map<number, typeof courses>();
  for (const course of courses) {
    if (!bySemester.has(course.semester)) bySemester.set(course.semester, []);
    bySemester.get(course.semester)!.push(course);
  }

  const totals = courses.reduce(
    (acc, c) => ({
      papers: acc.papers + c.paper_count,
      questions: acc.questions + c.question_count,
      notes: acc.notes + c.note_count,
    }),
    { papers: 0, questions: 0, notes: 0 }
  );

  return (
    <main>
      <section className="page-head">
        <div className="shell">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href="/departments">Branches</Link>
            <span aria-hidden>/</span>
            <span aria-current="page">{department.code}</span>
          </nav>

          <div className="row between wrap gap-20" style={{ alignItems: 'flex-end' }}>
            <div>
              <h1>{department.name}</h1>
              <p className="lead" style={{ marginTop: 8 }}>{department.full_name}</p>
            </div>
            <div className="row gap-10 wrap">
              <Link href={`/papers?dept=${department.code}`} className="btn btn-primary btn-sm">
                <Icon name="archive" size={16} /> Past papers library
              </Link>
              <Link href={`/search?q=${encodeURIComponent(department.code)}`} className="btn btn-outline btn-sm">
                <Icon name="search" size={16} /> Search within {department.code}
              </Link>
            </div>
          </div>

          <div className="panel panel-pad" style={{ marginTop: 28 }}>
            <div className="stats">
              <div className="stat">
                <div className="stat-value">{courses.length}</div>
                <div className="stat-label">Courses</div>
              </div>
              <div className="stat">
                <div className="stat-value">{totals.papers}</div>
                <div className="stat-label">Papers</div>
              </div>
              <div className="stat">
                <div className="stat-value">{totals.questions}</div>
                <div className="stat-label">Questions indexed</div>
              </div>
              <div className="stat">
                <div className="stat-value">{totals.notes}</div>
                <div className="stat-label">Note sets</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ paddingBottom: 'var(--space-16)' }}>
        <div className="shell stack gap-40">
          {[...bySemester.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([semester, semesterCourses]) => (
              <section key={semester} aria-labelledby={`sem-${semester}`}>
                <div className="row gap-12" style={{ alignItems: 'baseline' }}>
                  <h2 id={`sem-${semester}`} style={{ fontSize: 30 }}>Semester {semester}</h2>
                  <span className="xs muted">
                    {semesterCourses.length} course{semesterCourses.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="book-grid" style={{ marginTop: 18 }}>
                  {semesterCourses.map((c) => (
                    // SQLite rows have a null prototype; client components need plain objects.
                    <CourseBook key={c.code} course={{ ...c }} from={department.accent_from} to={department.accent_to} />
                  ))}
                </div>
              </section>
            ))}

          {!courses.length && (
            <div className="empty">
              <p className="empty-title">This shelf is still empty</p>
              <p className="small" style={{ marginTop: 8 }}>
                No courses have been indexed for {department.name} yet.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
