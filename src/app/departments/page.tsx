import Link from 'next/link';
import { getDepartments } from '@/lib/db';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  active: { text: 'Indexed', className: 'tag tag-positive' },
  growing: { text: 'In progress', className: 'tag tag-amber' },
  planned: { text: 'Planned', className: 'tag' },
};

export default function DepartmentsPage() {
  const departments = getDepartments();

  return (
    <main>
      <section className="section-sm">
        <div className="shell">
          <div className="label">Coverage</div>
          <h1 style={{ marginTop: 14 }}>Branches</h1>
          <p className="lead" style={{ marginTop: 14, maxWidth: 640 }}>
            Papers are indexed branch by branch. Each course keeps its own papers, note
            sets and — where available — syllabus schemes per academic year.
          </p>
        </div>
      </section>

      <section style={{ paddingBottom: 72 }}>
        <div className="shell">
          <div className="panel panel-pad">
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
                    <th>Status</th>
                    <th />
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
                          <div style={{ fontWeight: 500 }}>{d.name}</div>
                          <div className="xs muted">{d.full_name}</div>
                        </td>
                        <td className="num">{d.course_count}</td>
                        <td className="num">{d.paper_count}</td>
                        <td className="num">{d.question_count}</td>
                        <td className="num">{d.note_count}</td>
                        <td>
                          <span className={status.className}>{status.text}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {d.course_count > 0 ? (
                            <Link href={`/departments/${d.code}`} className="small">
                              Open →
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
            scanned paper for one of them is the fastest way to open it up — see the{' '}
            <Link href="/about#contribute">contribute</Link> section.
          </p>
        </div>
      </section>
    </main>
  );
}
