import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCoursesByDept, getDepartment } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function DepartmentPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const department = getDepartment(code);
  if (!department) notFound();

  const courses = getCoursesByDept(code);
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
      <section className="section-sm">
        <div className="shell">
          <p className="small muted">
            <Link href="/departments">Branches</Link> <span className="muted">/</span>{' '}
            {department.code}
          </p>

          <div className="row between wrap gap-20" style={{ marginTop: 16, alignItems: 'flex-end' }}>
            <div>
              <h1>{department.name}</h1>
              <p className="lead" style={{ marginTop: 8 }}>{department.full_name}</p>
            </div>
            <Link
              href={`/search?q=${encodeURIComponent(department.code)}`}
              className="btn btn-outline btn-sm"
            >
              Search within {department.code}
            </Link>
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

      <section style={{ paddingBottom: 72 }}>
        <div className="shell stack gap-32">
          {[...bySemester.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([semester, semesterCourses]) => (
              <div key={semester}>
                <div className="label">Semester {semester}</div>
                <div className="panel panel-pad" style={{ marginTop: 12 }}>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th style={{ width: 90 }}>Code</th>
                          <th>Course</th>
                          <th className="nums">Credits</th>
                          <th className="nums">Papers</th>
                          <th className="nums">Questions</th>
                          <th className="nums">Notes</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {semesterCourses.map((c) => (
                          <tr key={c.code}>
                            <td>
                              <span className="tag tag-code">{c.code}</span>
                            </td>
                            <td style={{ fontWeight: 500 }}>{c.title}</td>
                            <td className="num">{c.credits}</td>
                            <td className="num">{c.paper_count}</td>
                            <td className="num">{c.question_count}</td>
                            <td className="num">{c.note_count}</td>
                            <td style={{ textAlign: 'right' }}>
                              <Link href={`/courses/${c.code}`} className="small">
                                Open →
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </section>
    </main>
  );
}
