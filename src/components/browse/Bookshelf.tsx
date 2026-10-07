import Link from 'next/link';
import type { DepartmentWithStats } from '@/lib/types';

/**
 * Branches as book spines on a shelf. Spine height encodes how much material
 * a branch has; branches with no courses yet stand dimmed and are not links.
 */
export function Bookshelf({ departments, label = 'Branches' }: { departments: DepartmentWithStats[]; label?: string }) {
  const most = Math.max(...departments.map((d) => d.question_count), 1);

  return (
    <div className="shelf-wrap">
      <ul className="shelf" aria-label={label}>
        {departments.map((d) => {
          const style = {
            '--from': d.accent_from,
            '--to': d.accent_to,
            '--h': `${Math.round(190 + (d.question_count / most) * 90)}px`,
          } as React.CSSProperties;
          const body = (
            <>
              <span className="spine-band" aria-hidden />
              <span className="spine-code">{d.code}</span>
              <span className="spine-title">{d.name}</span>
              <span className="spine-band" aria-hidden />
              <span className="spine-meta nums">{d.course_count > 0 ? `${d.question_count} Q` : 'Soon'}</span>
            </>
          );
          return (
            <li key={d.code} className="shelf-slot">
              {d.course_count > 0 ? (
                <Link
                  href={`/departments/${d.code}`}
                  className="spine"
                  style={style}
                  aria-label={`${d.full_name}: ${d.course_count} courses, ${d.question_count} questions, ${d.note_count} note sets`}
                >
                  {body}
                </Link>
              ) : (
                <span className="spine is-planned" style={style} aria-label={`${d.full_name}: planned, no papers yet`} role="img">
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
