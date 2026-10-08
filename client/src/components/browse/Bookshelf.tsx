import Link from 'next/link';
import type { BranchInfo } from '@/lib/branches';

export type ShelfBranch = BranchInfo & { courses: number; papers: number; questions: number };

/**
 * Branches as book spines on a shelf. Spine height encodes how many questions
 * a branch has; branches with no papers yet stand dimmed and are not links.
 */
export function Bookshelf({ branches, label = 'Branches' }: { branches: ShelfBranch[]; label?: string }) {
  const most = Math.max(...branches.map((d) => d.questions), 1);

  return (
    <div className="shelf-wrap">
      <ul className="shelf" aria-label={label}>
        {branches.map((d) => {
          const style = {
            '--from': d.from,
            '--to': d.to,
            '--h': `${Math.round(190 + (d.questions / most) * 90)}px`,
          } as React.CSSProperties;
          const body = (
            <>
              <span className="spine-band" aria-hidden />
              <span className="spine-code">{d.code === 'COMMON' ? 'ALL' : d.code}</span>
              <span className="spine-title">{d.name}</span>
              <span className="spine-band" aria-hidden />
              <span className="spine-meta nums">{d.papers > 0 ? `${d.questions} Q` : 'Soon'}</span>
            </>
          );
          return (
            <li key={d.code} className="shelf-slot">
              {d.papers > 0 ? (
                <Link
                  href={`/departments/${d.code}`}
                  className="spine"
                  style={style}
                  aria-label={`${d.fullName}: ${d.courses} courses, ${d.papers} papers, ${d.questions} questions`}
                >
                  {body}
                </Link>
              ) : (
                <span className="spine is-planned" style={style} aria-label={`${d.fullName}: no papers yet`} role="img">
                  {body}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="shelf-board" aria-hidden />
    </div>
  );
}
