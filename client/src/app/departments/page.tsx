import type { Metadata } from 'next';
import Link from 'next/link';
import { Bookshelf } from '@/components/browse/Bookshelf';
import { getShelfBranches } from '@/lib/shelf-data';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Branches',
  description: 'Browse indexed previous year papers by branch and course.',
};

export default async function DepartmentsPage() {
  const branches = await getShelfBranches();

  return (
    <main>
      <section className="page-head">
        <div className="shell">
          <p className="eyebrow">Coverage</p>
          <h1>Branches</h1>
          <p className="lead">
            Every paper is filed under the branch printed on its header; papers set for all branches sit on the
            common shelf. Taller spines hold more questions.
          </p>
        </div>
      </section>

      <section style={{ paddingBottom: 'var(--space-12)' }}>
        <div className="shell">
          <Bookshelf branches={branches} />
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
                    <th style={{ width: 90 }}>Code</th>
                    <th>Branch</th>
                    <th className="nums">Courses</th>
                    <th className="nums">Papers</th>
                    <th className="nums">Questions</th>
                    <th><span className="visually-hidden">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map((d) => (
                    <tr key={d.code}>
                      <td>
                        <span className="tag tag-code tag-accent">{d.code === 'COMMON' ? 'ALL' : d.code}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{d.name}</div>
                        <div className="xs muted">{d.fullName}</div>
                      </td>
                      <td className="num">{d.courses}</td>
                      <td className="num">{d.papers}</td>
                      <td className="num">{d.questions}</td>
                      <td style={{ textAlign: 'right' }}>
                        <Link href={`/departments/${d.code}`} className="small" aria-label={`Open ${d.name}`}>
                          Open →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="notice" style={{ marginTop: 24 }}>
            Missing your branch? Signed-in uploaders can add papers from the <Link href="/upload">upload page</Link>;
            they are split into questions, tagged and searchable within a minute.
          </p>
        </div>
      </section>
    </main>
  );
}
