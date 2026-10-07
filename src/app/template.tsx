'use client';

import { usePathname } from 'next/navigation';
import { useLayoutEffect, useRef } from 'react';

/**
 * Each new page fades and rises in. The root template only remounts when the
 * top-level segment changes, so the animation is restarted on every pathname
 * change instead. The first page of a visit skips it (the hero and intro have
 * their own entrance). CSS only, and off for reduced motion.
 */
let hydrated = false;

export default function Template({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Layout effect: the class must be on before the new page first paints.
  useLayoutEffect(() => {
    if (!hydrated) {
      hydrated = true;
      return;
    }
    const el = ref.current;
    if (!el) return;
    el.classList.remove('page-enter');
    void el.offsetWidth; // restart the animation
    el.classList.add('page-enter');
  }, [pathname]);

  return (
    <div ref={ref} className="page">
      {children}
    </div>
  );
}
