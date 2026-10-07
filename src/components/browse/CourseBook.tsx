'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Tilt } from '@/components/ui/Tilt';
import type { CourseWithStats } from '@/lib/types';

const OPEN_MS = 420;

/**
 * A course as a bound book. Selecting it swings the cover open, then navigates.
 * Modified clicks (new tab etc.) and reduced effects skip the animation.
 */
export function CourseBook({
  course,
  from,
  to,
}: {
  course: CourseWithStats;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const href = `/courses/${course.code}`;

  function onClick(event: React.MouseEvent<HTMLAnchorElement>) {
    const effectsOff = document.documentElement.dataset.effects === 'off';
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0 || effectsOff) return;
    event.preventDefault();
    if (opening) return;
    setOpening(true);
    window.setTimeout(() => router.push(href), OPEN_MS);
  }

  return (
    <Tilt className="book-tilt">
      <Link
        href={href}
        onClick={onClick}
        className={`book${opening ? ' is-opening' : ''}`}
        style={{ '--from': from, '--to': to } as React.CSSProperties}
        aria-busy={opening || undefined}
      >
        <span className="book-inside" aria-hidden>
          <span className="book-inside-title">{course.title}</span>
          <span className="spinner" />
        </span>
        <span className="book-cover">
          <span className="book-frame" aria-hidden />
          <span className="book-code">{course.code}</span>
          <span className="book-title">{course.title}</span>
          <span className="book-meta nums">
            <span>{course.question_count} questions</span>
            <span>{course.paper_count} papers</span>
            <span>{course.note_count} notes</span>
          </span>
          <span className="book-credits">{course.credits} credits</span>
        </span>
      </Link>
    </Tilt>
  );
}
