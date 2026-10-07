import type { Metadata } from 'next';
import Link from 'next/link';
import { Bookshelf } from '@/components/browse/Bookshelf';
import { getDepartments } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Branches',
  description: 'Browse previous year papers, notes and syllabus schemes by branch and semester.',
};

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  active: { text: 'Indexed', className: 'tag tag-positive' },
  growing: { text: 'In progress', className: 'tag tag-amber' },
  planned: { text: 'Planned', className: 'tag' },
};

export default function DepartmentsPage() {
  const departments = getDepartments();

  return (
    <main>
      <section className="page-head">
        <div className="shell">
          <p className="eyebrow">Coverage</p>
          <h1>Branches</h1>
          <p className="lead">
            Papers are indexed branch by branch. Each course keeps its own papers, note sets and,
            where available, syllabus schemes per academic year. Taller spines hold more papers.
          </p>
        </div>
      </section>

      <section style={{ paddingBottom: 'var(--space-12)' }}>
        <div className="shell">
          <Bookshelf departments={departments} />
        </div>
      </section>

      <section style={{ paddingBottom: 'var(--space-16)' }} aria-labelledby="coverage-title">
        <div className="shell">
          <h2 id="coverage-title" style={{ fontSize: 30 }}>Coverage in detail</h2>
          <div className="panel panel-pad" style={{ marginTop: 18 }}>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 70 }}>Code</th>
                    <th>Branch</th>
                    <th className="nums">Courses</th>
                    <th className="nums">Papers</th>
                    <th className="nums">Questions</th>
                    <th className="nums">Notes</th>
                    <th className="nums">Library</th>
                    <th>Status</th>
                    <th><span className="visually-hidden">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((d) => {
                    const status = STATUS_LABEL[d.status] ?? STATUS_LABEL.planned;
                    return (
                      <tr key={d.code}>
                        <td>
                          <span className="tag tag-code tag-accent">{d.code}</span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{d.name}</div>
                          <div className="xs muted">{d.full_name}</div>
                        </td>
                        <td className="num">{d.course_count}</td>
                        <td className="num">{d.paper_count}</td>
                        <td className="num">{d.question_count}</td>
                        <td className="num">{d.note_count}</td>
                        <td className="num">
                          {d.library_count > 0 ? (
                            <Link href={`/papers?dept=${d.code}`} aria-label={`${d.library_count} past papers for ${d.name}`}>{d.library_count}</Link>
                          ) : (
                            0
                          )}
                        </td>
                        <td>
                          <span className={status.className}>{status.text}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {d.course_count > 0 ? (
                            <Link href={`/departments/${d.code}`} className="small" aria-label={`Open ${d.name}`}>
                              Open →
                            </Link>
                          ) : d.library_count > 0 ? (
                            <Link href={`/papers?dept=${d.code}`} className="small" aria-label={`Past papers for ${d.name}`}>
                              Papers →
                            </Link>
                          ) : (
                            <span className="xs muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <p className="notice" style={{ marginTop: 24 }}>
            Branches marked <strong>Planned</strong> have no papers digitised yet. Contributing a
            scanned paper for one of them is the fastest way to open it up. See the{' '}
            <Link href="/about#contribute">contribute</Link> section.
          </p>
        </div>
      </section>
    </main>
  );
}
