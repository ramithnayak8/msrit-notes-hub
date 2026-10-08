import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { apiGet, type SchemeCourse } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Courses',
  description: 'The current scheme of teaching, each course linked to past papers on the same subject, whatever code they were set under.',
};

export default async function CoursesPage() {
  const { items } = await apiGet<{ items: SchemeCourse[] }>('/courses');
  const schemes = [...new Set(items.map((c) => `${c.scheme}|${c.semester}`))];
  const reused = items.filter((c) => c.codeReusedBy.length > 0);

  return (
    <main>
      <section className="page-head">
        <div className="shell">
          <p className="eyebrow">Current scheme</p>
          <h1>Courses</h1>
          <p className="lead" style={{ maxWidth: 760 }}>
            Schemes change: subjects get renamed, merged and moved, and course codes get reused for different subjects.
            Each current course is linked to past papers on the same subject by comparing course titles, not codes.
          </p>
        </div>
      </section>

      {reused.length > 0 && (
        <section style={{ paddingBottom: 'var(--space-8)' }}>
          <div className="shell">
            <div className="notice">
              <strong>Codes that changed meaning:</strong>{' '}
              {reused.map((c, i) => (
                <span key={c.code}>
                  {i > 0 && '; '}
                  <strong>{c.code}</strong> is now {c.title}, but older papers under {c.code} are{' '}
                  {c.codeReusedBy.map((r) => `${r.title} (${r.years.join(', ')})`).join(' and ')}
                </span>
              ))}
              . Searching by topic finds the right questions either way.
            </div>
          </div>
        </section>
      )}

      {schemes.map((key) => {
        const [scheme, semester] = key.split('|');
        const courses = items.filter((c) => c.scheme === scheme && String(c.semester) === semester);
        return (
          <section key={key} style={{ paddingBottom: 'var(--space-16)' }} aria-labelledby={`scheme-${key}`}>
            <div className="shell">
              <h2 id={`scheme-${key}`} style={{ fontSize: 30 }}>
                CSE (AI &amp; ML) · Semester {semester} · {scheme} scheme
              </h2>
              <div className="panel panel-pad" style={{ marginTop: 18 }}>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: 100 }}>Code</th>
                        <th>Course</th>
                        <th>Past papers on this subject</th>
                        <th><span className="visually-hidden">Open</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {courses.map((c) => {
                        const papers = c.pastPapers.reduce((n, p) => n + p.papers, 0);
                        return (
                          <tr key={c.code}>
                            <td>
                              <span className="tag tag-code tag-accent">{c.code}</span>
                            </td>
                            <td style={{ fontWeight: 600 }}>{c.title}</td>
                            <td>
                              {c.pastPapers.length ? (
                                <div className="stack gap-4">
                                  {c.pastPapers.map((p) => (
                                    <span key={`${p.code}-${p.title}`} className="small">
                                      <Link href={`/courses/${p.code}`}>{p.code}</Link> <span className="soft">{p.title}</span>{' '}
                                      <span className="xs muted nums">
                                        · {p.papers} paper{p.papers === 1 ? '' : 's'}
                                        {p.years.length ? ` · ${p.years.join(', ')}` : ''}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="xs muted">None yet: searching the topic still finds related questions</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              {papers > 0 ? (
                                <Link href={`/courses/${c.code}`} className="small">
                                  {papers} paper{papers === 1 ? '' : 's'} →
                                </Link>
                              ) : (
                                <Link href={`/search?q=${encodeURIComponent(c.title)}`} className="small">
                                  <Icon name="search" size={13} /> Search
                                </Link>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </main>
  );
}
