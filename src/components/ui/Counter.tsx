'use client';

import { useEffect, useRef } from 'react';

const format = (n: number) => n.toLocaleString('en-IN');

/**
 * A number that counts up the first time it scrolls into view. The final
 * value is server-rendered, so crawlers, no-JS and "Still" effects see it as is.
 */
export function Counter({ value, duration = 1400 }: { value: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || document.documentElement.dataset.effects === 'off' || !('IntersectionObserver' in window)) return;

    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - t, 4);
          el.textContent = format(Math.round(value * eased));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        el.textContent = '0';
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.6 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      el.textContent = format(value);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className="nums">
      {format(value)}
    </span>
  );
}
