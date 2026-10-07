'use client';

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

      let last = performance.now();
      const tick = (now: number) => {
        field.frame(now - last);
        last = now;
        frame = requestAnimationFrame(tick);
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
