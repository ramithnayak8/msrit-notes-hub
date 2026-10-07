import Link from 'next/link';

const COLUMNS = [
  {
    title: 'Archive',
    links: [
      { href: '/search', label: 'Search questions' },
      { href: '/papers', label: 'Past papers library' },
      { href: '/departments', label: 'Branches' },
      { href: '/syllabus', label: 'Syllabus changes' },
    ],
  },
  {
    title: 'Tools',
    links: [
      { href: '/assistant', label: 'Study assistant' },
      { href: '/shelf', label: 'My shelf' },
      { href: '/api/stats', label: 'Public API' },
    ],
  },
  {
    title: 'Project',
    links: [
      { href: '/about', label: 'About' },
      { href: '/about#contribute', label: 'Contribute papers' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="footer">
      <div className="shell">
        <div className="footer-cols">
          <div>
            <div className="row gap-10">
              <span className="brand-mark" aria-hidden>C</span>
              <span className="brand-name">ConceptQuery</span>
            </div>
            <p className="small muted" style={{ marginTop: 14, maxWidth: 340 }}>
              A quiet place to study past papers, notes and syllabus schemes, indexed by concept
              rather than by subject code.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <div className="label">{column.title}</div>
              <div style={{ marginTop: 10 }}>
                {column.links.map((link) => (
                  <Link key={link.href} href={link.href} className="footer-link">
                    {link.label}
                  </Link>
                ))}
              </div>
            </nav>
          ))}
        </div>

        <div
          className="row between wrap gap-16"
          style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid var(--rule)' }}
        >
          <p className="xs muted">
            An independent student project. Not officially affiliated with or endorsed by
            Ramaiah Institute of Technology.
          </p>
          <p className="xs muted">© {new Date().getFullYear()} ConceptQuery</p>
        </div>
      </div>
    </footer>
  );
}
