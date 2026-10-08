import type { Metadata } from 'next';
import Link from 'next/link';
import { CourseBook } from '@/components/browse/CourseBook';
import { Icon } from '@/components/ui/Icon';
import { apiGet, type CatalogCourse } from '@/lib/api';
import { branchInfo } from '@/lib/branches';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const branch = branchInfo((await params).code.toUpperCase());
  return { title: branch.fullName, description: `Indexed previous year papers for ${branch.fullName}, by semester.` };
}

export default async function DepartmentPage({ params }: Params) {
  const code = (await params).code.toUpperCase();
  const branch = branchInfo(code);
  const { items: courses } = await apiGet<{ items: CatalogCourse[] }>(`/catalog?branch=${encodeURIComponent(code)}`);

  const bySemester = new Map<number, CatalogCourse[]>();
  for (const course of courses) {
    const sem = course.semester ?? 0;
    if (!bySemester.has(sem)) bySemester.set(sem, []);
    bySemester.get(sem)!.push(course);
  }
  const totals = courses.reduce((acc, c) => ({ papers: acc.papers + c.papers, questions: acc.questions + c.questions }), { papers: 0, questions: 0 });

  return (
    <main>
      <section className="page-head">
        <div className="shell">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href="/departments">Branches</Link>
            <span aria-hidden>/</span>
            <span aria-current="page">{code === 'COMMON' ? 'All branches' : code}</span>
          </nav>

          <div className="row between wrap gap-20" style={{ alignItems: 'flex-end' }}>
            <div>
              <h1>{branch.name}</h1>
              <p className="lead" style={{ marginTop: 8 }}>{branch.fullName}</p>
            </div>
            {code !== 'COMMON' && (
              <Link href={`/search?q=${encodeURIComponent(code)}`} className="btn btn-outline btn-sm">
                <Icon name="search" size={16} /> Search within {code}
              </Link>
            )}
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
            </div>
          </div>
        </div>
      </section>

      <section style={{ paddingBottom: 'var(--space-16)' }}>
        <div className="shell stack gap-40">
          {[...bySemester.entries()]
            .sort((a, b) => (a[0] || 99) - (b[0] || 99))
            .map(([semester, semesterCourses]) => (
              <section key={semester} aria-labelledby={`sem-${semester}`}>
                <div className="row gap-12" style={{ alignItems: 'baseline' }}>
                  <h2 id={`sem-${semester}`} style={{ fontSize: 30 }}>{semester ? `Semester ${semester}` : 'Semester not printed'}</h2>
                  <span className="xs muted">
                    {semesterCourses.length} course{semesterCourses.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="book-grid" style={{ marginTop: 18 }}>
                  {semesterCourses.map((c) => (
                    <CourseBook key={c.code} course={c} from={branch.from} to={branch.to} />
                  ))}
                </div>
              </section>
            ))}

          {!courses.length && (
            <div className="empty">
              <p className="empty-title">This shelf is still empty</p>
              <p className="small" style={{ marginTop: 8 }}>
                No papers have been indexed for {branch.name} yet. <Link href="/upload">Upload one</Link>.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
