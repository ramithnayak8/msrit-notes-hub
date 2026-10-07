'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useStudyRoom } from '@/components/study/StudyRoomProvider';
import { useFocus } from '@/components/study/FocusProvider';

export const NAV_LINKS = [
  { href: '/search', label: 'Search' },
  { href: '/departments', label: 'Branches' },
  { href: '/syllabus', label: 'Syllabus changes' },
  { href: '/assistant', label: 'Study assistant' },
];

export function Masthead() {
  const pathname = usePathname();
  const { open, overlay } = useStudyRoom();
  const focus = useFocus();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu on navigation and on Escape.
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <header className="masthead">
      <div className="masthead-inner">
        <Link href="/" className="brand" aria-label="ConceptQuery home">
          <span className="brand-mark" aria-hidden>C</span>
          <span className="brand-text">
            <span className="brand-name">ConceptQuery</span>
            <span className="brand-sub">MSRIT · Study archive</span>
          </span>
        </Link>

        <nav className="nav-links" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link${isActive(link.href) ? ' active' : ''}`}
              aria-current={isActive(link.href) ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="masthead-actions">
          {/* A real link to /search until JavaScript loads; then it opens the palette. */}
          <Link
            href="/search"
            className="search-trigger"
            aria-label="Search (Ctrl K)"
            aria-haspopup="dialog"
            onClick={(event) => {
              event.preventDefault();
              open('palette');
            }}
          >
            <Icon name="search" />
            <span className="search-trigger-text">Search everything</span>
            <span className="kbd search-trigger-kbd">Ctrl K</span>
          </Link>
          <Link
            href="/shelf"
            className={`icon-btn masthead-shelf${isActive('/shelf') ? ' active' : ''}`}
            aria-label="My shelf"
            aria-current={isActive('/shelf') ? 'page' : undefined}
            title="My shelf"
          >
            <Icon name="bookmark" />
          </Link>
          <button
            type="button"
            className={`icon-btn${focus.running ? ' is-live' : ''}`}
            aria-label={focus.running ? 'Focus timer (running)' : 'Focus timer'}
            aria-haspopup="dialog"
            aria-expanded={overlay === 'focus'}
            title="Focus timer"
            onClick={() => open('focus')}
          >
            <Icon name="timer" />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Study room"
            aria-label="Study room settings"
            aria-haspopup="dialog"
            aria-expanded={overlay === 'room'}
            onClick={() => open('room')}
          >
            <Icon name="sliders" />
          </button>
          <button
            type="button"
            className="icon-btn menu-toggle"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div id="mobile-menu" className="mobile-menu">
          <nav aria-label="Mobile">
            {[{ href: '/', label: 'Home' }, ...NAV_LINKS, { href: '/shelf', label: 'My shelf' }, { href: '/about', label: 'About' }].map((link) => {
              const current = link.href === '/' ? pathname === '/' : isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="mobile-menu-link"
                  aria-current={current ? 'page' : undefined}
                >
                  {link.label}
                  <Icon name="chevronRight" />
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            className="btn btn-outline"
            style={{ marginTop: 28, width: '100%' }}
            onClick={() => {
              setMenuOpen(false);
              open('room');
            }}
          >
            <Icon name="sliders" /> Theme, ambience and sound
          </button>
        </div>
      )}
    </header>
  );
}
