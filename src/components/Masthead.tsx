'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/search', label: 'Search' },
  { href: '/departments', label: 'Branches' },
  { href: '/syllabus', label: 'Syllabus changes' },
  { href: '/assistant', label: 'Study assistant' },
];

export function Masthead() {
  const pathname = usePathname();

  return (
    <header className="masthead">
      <div className="masthead-inner">
        <Link href="/" className="brand">
          <span className="brand-mark">C</span>
          <span className="brand-text">
            <span className="brand-name">ConceptQuery</span>
            <span className="brand-sub">MSRIT · Topic-aware retrieval</span>
          </span>
        </Link>

        <nav className="nav-links">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link${pathname.startsWith(link.href) ? ' active' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link href="/search" className="btn btn-outline btn-sm">
          Search the archive
        </Link>
      </div>
    </header>
  );
}
