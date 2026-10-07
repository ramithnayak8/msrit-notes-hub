'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useStudyRoom } from '@/components/study/StudyRoomProvider';
import { sceneById } from './scenes';

/**
 * Fixed layer behind all content. The glow is CSS on [data-ambience] and
 * paints with the HTML; the particle field loads after hydration, pauses in
 * hidden tabs and is skipped entirely when effects are off.
 */
export function AmbienceLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { prefs, effects, ready } = useStudyRoom();
  const pathname = usePathname();
  // True while the home hero (opaque, with its own WebGL scene) fills most of the screen.
  const covered = useRef(false);

  useEffect(() => {
    const hero = document.querySelector('.hero');
    covered.current = false;
    if (!hero) return;
    const observer = new IntersectionObserver(([entry]) => (covered.current = entry.intersectionRatio > 0.75), {
      threshold: [0, 0.75, 1],
    });
    observer.observe(hero);
    return () => observer.disconnect();
  }, [pathname]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!ready || !canvas || effects === 'off') return;

    let cancelled = false;
    let frame = 0;
    let cleanup = () => {};

    import('./particles').then(({ ParticleField }) => {
      if (cancelled) return;
      const scene = sceneById(prefs.ambience);
      const field = new ParticleField(canvas, {
        kind: scene.particles,
        color: prefs.theme === 'dark' ? scene.color.dark : scene.color.light,
        density: scene.density,
        scale: effects === 'full' ? 1 : 0.5,
      });

      // Lite renders at ~30 fps; nothing is drawn while the hero hides the layer.
      const minStep = effects === 'full' ? 0 : 30;
      let last = performance.now();
      const tick = (now: number) => {
        frame = requestAnimationFrame(tick);
        if (now - last < minStep) return;
        if (!covered.current) field.frame(now - last);
        last = now;
      };
      const start = () => {
        cancelAnimationFrame(frame);
        last = performance.now();
        frame = requestAnimationFrame(tick);
      };
      const onVisibility = () => (document.hidden ? cancelAnimationFrame(frame) : start());
      let resizeTimer = 0;
      const onResize = () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => field.resize(), 150);
      };

      canvas.dataset.on = '';
      start();
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('resize', onResize);
      cleanup = () => {
        cancelAnimationFrame(frame);
        window.clearTimeout(resizeTimer);
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('resize', onResize);
        field.clear();
        delete canvas.dataset.on;
      };
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [ready, effects, prefs.ambience, prefs.theme]);

  return (
    <div className="ambience" aria-hidden>
      <div className="ambience-glow" />
      <canvas ref={canvasRef} className="ambience-canvas" />
    </div>
  );
}
