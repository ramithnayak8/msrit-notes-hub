import Link from 'next/link';
import type { DepartmentWithStats } from '@/lib/types';

/**
 * Branches as book spines on a shelf. Spine height encodes how much material
 * a branch has; branches with no courses yet stand dimmed and are not links.
 */
export function Bookshelf({ departments, label = 'Branches' }: { departments: DepartmentWithStats[]; label?: string }) {
  const material = (d: DepartmentWithStats) => d.question_count + d.library_count;
  const most = Math.max(...departments.map(material), 1);

  return (
    <div className="shelf-wrap">
      <ul className="shelf" aria-label={label}>
        {departments.map((d) => {
          const style = {
            '--from': d.accent_from,
            '--to': d.accent_to,
            '--h': `${Math.round(250 + Math.sqrt(material(d) / most) * 70)}px`,
            '--fs': d.name.length > 16 ? '14px' : d.name.length > 11 ? '16px' : '19px',
          } as React.CSSProperties;
          const body = (
            <>
              <span className="spine-band" aria-hidden />
              <span className="spine-code">{d.code}</span>
              <span className="spine-title">{d.name}</span>
              <span className="spine-band" aria-hidden />
              <span className="spine-meta nums">{material(d) > 0 ? `${d.paper_count + d.library_count} papers` : 'Soon'}</span>
            </>
          );
          return (
            <li key={d.code} className="shelf-slot">
              {material(d) > 0 ? (
                <Link
                  href={d.course_count > 0 ? `/departments/${d.code}` : `/papers?dept=${d.code}`}
                  className="spine"
                  style={style}
                  aria-label={`${d.full_name}: ${d.paper_count + d.library_count} papers, ${d.question_count} searchable questions`}
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
