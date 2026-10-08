import type { Metadata } from 'next';
import Link from 'next/link';
import { PaperRow } from '@/components/browse/PaperRow';
import { Icon } from '@/components/ui/Icon';
import { getDepartments, getLibraryStats, getPaperLibrary } from '@/lib/data';
import { EXAM_GROUPS, PAPER_SOURCES } from '@/lib/sources';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Past papers library',
  description:
    'Every CIE, SEE, makeup and backlog paper shared by MSRIT students, gathered from student-run archives and sorted by subject, year and branch.',
};

type Search = { q?: string; year?: string; dept?: string; exam?: string; page?: string };

const YEARS = [1, 2, 3, 4];
const ORDINAL = ['', 'First', 'Second', 'Third', 'Fourth'];

export default async function PapersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const year = YEARS.includes(Number(params.year)) ? Number(params.year) : undefined;
  const exam = EXAM_GROUPS.find((g) => g.id === params.exam);
  const departments = (await getDepartments()).filter((d) => d.status !== 'planned' || d.code === 'BT');
  const dept = departments.find((d) => d.code === params.dept)?.code;
  const q = (params.q ?? '').slice(0, 80);

  const [stats, library] = await Promise.all([
    getLibraryStats(),
    getPaperLibrary({ q, year, dept, exam: exam?.match, page: Number(params.page) || 1 }),
  ]);

  /** Link to this page with some filters changed; page resets unless set. */
  const href = (change: Partial<Search>) => {
    const next = { q: q || undefined, year: year?.toString(), dept, exam: exam?.id, ...change };
    const qs = new URLSearchParams(Object.entries(next).filter((e): e is [string, string] => !!e[1]));
    const s = qs.toString();
    return s ? `/papers?${s}` : '/papers';
  };
  const filtered = !!(q || year || dept || exam);

  return (
    <main>
      <section className="page-head">
        <div className="shell">
          <p className="eyebrow">Past papers library</p>
          <h1>Every paper, on one shelf</h1>
          <p className="lead">
            <span className="nums">{stats.papers.toLocaleString('en-IN')}</span> CIE, SEE, makeup and backlog papers across{' '}
            <span className="nums">{stats.subjects}</span> subjects, gathered from student-run archives and sorted by
            subject, year and branch. Each one opens the original file where it was shared.
          </p>
        </div>
      </section>

      <section className="shell library-filters" aria-label="Filter papers">
        <form action="/papers" method="get" className="library-search" role="search">
          <Icon name="search" size={18} />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Subject, course code or branch, e.g. DBMS, Maths, ECE"
            aria-label="Search past papers"
            autoComplete="off"
          />
          {year && <input type="hidden" name="year" value={year} />}
          {dept && <input type="hidden" name="dept" value={dept} />}
          {exam && <input type="hidden" name="exam" value={exam.id} />}
          <button type="submit" className="btn btn-primary btn-sm">Search</button>
        </form>

        <div className="filter-rows">
          <nav className="filter-row" aria-label="Year of study">
            <span className="label">Year</span>
            <Link href={href({ year: undefined })} className="chip" aria-current={!year ? 'true' : undefined}>All</Link>
            {YEARS.map((y) => (
              <Link key={y} href={href({ year: String(y) })} className="chip" aria-current={year === y ? 'true' : undefined}>
                {ORDINAL[y]}
              </Link>
            ))}
          </nav>
          <nav className="filter-row" aria-label="Exam">
            <span className="label">Exam</span>
            <Link href={href({ exam: undefined })} className="chip" aria-current={!exam ? 'true' : undefined}>All</Link>
            {EXAM_GROUPS.map((g) => (
              <Link key={g.id} href={href({ exam: g.id })} className="chip" aria-current={exam?.id === g.id ? 'true' : undefined}>
                {g.label}
              </Link>
            ))}
          </nav>
          <nav className="filter-row" aria-label="Branch">
            <span className="label">Branch</span>
            <Link href={href({ dept: undefined })} className="chip" aria-current={!dept ? 'true' : undefined}>All</Link>
            {departments.map((d) => (
              <Link key={d.code} href={href({ dept: d.code })} className="chip" aria-current={dept === d.code ? 'true' : undefined} title={d.full_name}>
                {d.code}
              </Link>
            ))}
          </nav>
        </div>

        <div className="row between wrap gap-12 library-summary">
          <p className="small muted nums" aria-live="polite">
            {library.totalPapers.toLocaleString('en-IN')} papers in {library.totalShelves} subject{library.totalShelves === 1 ? '' : 's'}
            {library.pages > 1 && <> · page {library.page} of {library.pages}</>}
          </p>
          {filtered && (
            <Link href="/papers" className="small">
              Clear filters
            </Link>
          )}
        </div>
      </section>

      <section className="shell library" aria-label="Papers by subject">
        {library.shelves.length === 0 && (
          <div className="empty">
            <span className="empty-mark"><Icon name="archive" size={40} strokeWidth={1.2} /></span>
            <p className="empty-title">Nothing on this shelf</p>
            <p className="small" style={{ marginTop: 8 }}>
              Try a shorter search, or <Link href="/papers">clear the filters</Link>.
            </p>
          </div>
        )}

        <div className="library-grid">
          {library.shelves.map((shelf) => (
            <article key={`${shelf.studyYear}-${shelf.subject}`} className="subject-shelf panel">
              <header className="subject-shelf-head">
                <div>
                  <h2 className="subject-shelf-title">{shelf.subject}</h2>
                  <p className="xs muted">
                    {shelf.studyYear ? `${ORDINAL[shelf.studyYear]} year` : 'Any year'}
                    {shelf.semesters.length > 0 && <> · Sem {shelf.semesters.sort().join(', ')}</>}
                    {shelf.branches.length > 0 && <> · {shelf.branches.slice(0, 4).join(', ')}{shelf.branches.length > 4 && ` +${shelf.branches.length - 4}`}</>}
                  </p>
                </div>
                <span className="tag nums">{shelf.papers.length}</span>
              </header>
              {shelf.courseCode && (
                <Link href={`/courses/${shelf.courseCode}`} className="subject-shelf-course">
                  <Icon name="search" size={14} /> Questions from {shelf.courseCode} are searchable here
                  <Icon name="arrowRight" size={14} />
                </Link>
              )}
              <ul className="paper-list">
                {shelf.papers.slice(0, 8).map((paper) => (
                  <PaperRow key={paper.id} paper={paper} />
                ))}
              </ul>
              {shelf.papers.length > 8 && (
                <details className="paper-more">
                  <summary>Show {shelf.papers.length - 8} more</summary>
                  <ul className="paper-list">
                    {shelf.papers.slice(8).map((paper) => (
                      <PaperRow key={paper.id} paper={paper} />
                    ))}
                  </ul>
                </details>
              )}
            </article>
          ))}
        </div>

        {library.pages > 1 && (
          <nav className="pager" aria-label="Pages">
            {library.page > 1 && (
              <Link href={href({ page: String(library.page - 1) })} className="btn btn-outline btn-sm" rel="prev">
                Previous
              </Link>
            )}
            <span className="small muted nums">
              Page {library.page} of {library.pages}
            </span>
            {library.page < library.pages && (
              <Link href={href({ page: String(library.page + 1) })} className="btn btn-outline btn-sm" rel="next">
                Next <Icon name="arrowRight" size={15} />
              </Link>
            )}
          </nav>
        )}
      </section>

      <section className="shell section-sm" aria-labelledby="sources-title">
        <div className="panel panel-pad sources-credit">
          <p className="eyebrow">Where these come from</p>
          <h2 id="sources-title" className="shelf-h" style={{ marginTop: 10 }}>Shared by students, linked with thanks</h2>
          <p className="small soft" style={{ marginTop: 10, maxWidth: 680 }}>
            These papers were uploaded by MSRIT students to the archives below. ConceptQuery only lists and sorts them;
            every link opens the original file on Google Drive, and nothing is copied or re-hosted. To add a paper,
            share it with one of these sites and it will appear here on the next refresh.
          </p>
          <div className="grid-2" style={{ marginTop: 18 }}>
            {Object.entries(PAPER_SOURCES).map(([id, s]) => (
              <a key={id} href={s.url} target="_blank" rel="noopener noreferrer" className="source-card">
                <span className="source-card-name">
                  {s.name} <Icon name="external" size={14} />
                </span>
                <span className="xs muted">{s.about}</span>
              </a>
            ))}
          </div>
          <p className="xs muted" style={{ marginTop: 14 }}>
            Sorting is automatic and reads folder and file names, so the occasional paper may sit under the wrong exam or
            year. Files belong to the people who shared them; if you uploaded one and want it unlisted, tell us on the{' '}
            <Link href="/about#contribute">about page</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
