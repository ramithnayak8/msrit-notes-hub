'use client';

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useStudyRoom } from '@/components/study/StudyRoomProvider';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { isCoarsePointer, supportsWebGL2 } from '@/lib/client/device';
import { HeroFallback } from './HeroFallback';
import { DESKTOP, MOBILE, type SceneInput, type SceneProfile } from './library/profile';

const LibraryCanvas = lazy(() => import('./library/LibraryCanvas'));

const FIRST_INTERACTION = ['pointerdown', 'touchstart', 'scroll', 'wheel', 'keydown'] as const;

/**
 * Decides whether the WebGL scene runs at all, when it loads, and when it
 * renders. It never blocks first paint:
 * - desktop: loads once the browser is idle after page load;
 * - touch devices and narrow screens: loads on the first interaction, so it
 *   never competes with the initial render on a phone;
 * - "lite"/"still" effects, no WebGL2, or a render error: the CSS scene stays.
 * Rendering pauses whenever the hero is off-screen or the tab is hidden.
 */
export function HeroBackdrop() {
  const { effects, ready } = useStudyRoom();
  const root = useRef<HTMLDivElement>(null);
  const input = useMemo<SceneInput>(() => ({ scroll: 0, pointerX: 0, pointerY: 0 }), []);
  const [profile, setProfile] = useState<SceneProfile>(DESKTOP);
  const [load, setLoad] = useState(false);
  const [shown, setShown] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (effects !== 'full') {
      setLoad(false);
      setShown(false);
      return;
    }
    const coarse = isCoarsePointer();
    const small = window.innerWidth < 900;
    setProfile(coarse || window.innerWidth < 768 ? MOBILE : DESKTOP);

    // Probing WebGL creates a GL context, which is not free, so it waits
    // until the scene is actually about to load.
    const go = () => {
      if (supportsWebGL2()) setLoad(true);
    };
    if (coarse || small) {
      FIRST_INTERACTION.forEach((type) => window.addEventListener(type, go, { once: true, passive: true }));
      return () => FIRST_INTERACTION.forEach((type) => window.removeEventListener(type, go));
    }
    // Safari has no requestIdleCallback.
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(go, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(go, 1200);
    return () => clearTimeout(id);
  }, [effects, ready]);

  // Inputs are written to a plain object and read in the render loop: no re-renders.
  useEffect(() => {
    const el = root.current;
    if (!el || !load) return;
    const onScroll = () => {
      input.scroll = Math.min(Math.max(window.scrollY / Math.max(el.offsetHeight, 1), 0), 1);
    };
    const onPointer = (e: PointerEvent) => {
      input.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      input.pointerY = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    const onVisibility = () => setTabVisible(document.visibilityState === 'visible');
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0 });

    onScroll();
    observer.observe(el);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [input, load]);

  return (
    <div ref={root} className="hero-backdrop" aria-hidden>
      <HeroFallback hidden={shown} />
      {load && (
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <div className={`hero-canvas${shown ? ' is-shown' : ''}`}>
              <LibraryCanvas
                profile={profile}
                input={input}
                active={onScreen && tabVisible}
                onReady={() => setShown(true)}
              />
            </div>
          </Suspense>
        </ErrorBoundary>
      )}
      <div className="hero-scrim" />
    </div>
  );
}
