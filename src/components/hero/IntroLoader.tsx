'use client';

import { useEffect } from 'react';
import { endIntro } from '@/lib/client/intro';

/**
 * Branded loader for the first visit of a session. Its timing is pure CSS
 * (about 1.3 s, keyed off html[data-intro], which the boot script sets), so
 * it plays even before JavaScript arrives. This component only adds skipping.
 */
export function IntroLoader() {
  useEffect(() => {
    if (!document.documentElement.dataset.intro) return;
    const skip = () => endIntro();
    window.addEventListener('keydown', skip, { once: true });
    return () => window.removeEventListener('keydown', skip);
  }, []);

  return (
    <div className="intro" onClick={() => endIntro()} aria-hidden>
      <div className="intro-mark">
        <svg viewBox="0 0 64 64" width="72" height="72">
          <circle className="intro-ring" cx="32" cy="32" r="28" />
          <path className="intro-c" d="M43 22.5a14 14 0 1 0 0 19" />
        </svg>
        <span className="intro-word">ConceptQuery</span>
      </div>
      <button type="button" className="intro-skip" onClick={() => endIntro()} tabIndex={-1}>
        Skip intro
      </button>
    </div>
  );
}
