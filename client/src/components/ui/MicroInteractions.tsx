'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useStudyRoom } from '@/components/study/StudyRoomProvider';

const INTERACTIVE = 'a, button, [role="option"], input, select, textarea, label, summary, [data-magnetic]';
const MAGNETIC = '[data-magnetic], .btn-primary';
const MAX_PULL = 8;

const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

type LenisLike = { stop(): void; start(): void; destroy(): void; resize(): void };

/**
 * Desktop-only polish, mounted once: a gold halo that trails the native
 * cursor, buttons that lean towards the pointer, and Lenis smooth scrolling.
 * All of it is off for touch, for "Still" effects and for reduced motion.
 */
export function MicroInteractions() {
  const { effects, overlay, ready } = useStudyRoom();
  const pathname = usePathname();
  const lenisRef = useRef<LenisLike | null>(null);
  const haloRef = useRef<HTMLDivElement>(null);

  // Smooth scrolling (full effects only; it is the most noticeable of the three).
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!ready || effects !== 'full' || reduced || !finePointer()) return;
    let cancelled = false;
    import('lenis').then(({ default: Lenis }) => {
      if (cancelled) return;
      lenisRef.current = new Lenis({
        autoRaf: true,
        lerp: 0.12,
        anchors: { offset: -80 },
        // Scrollable panels keep native scrolling.
        prevent: (node) => !!node.closest('dialog, .mobile-menu, .palette-list, .assistant-log, .table-wrap'),
      });
    });
    return () => {
      cancelled = true;
      lenisRef.current?.destroy();
      lenisRef.current = null;
    };
  }, [ready, effects]);

  // Modals and the mobile menu own the wheel while they are open.
  useEffect(() => {
    if (overlay) lenisRef.current?.stop();
    else lenisRef.current?.start();
  }, [overlay]);

  useEffect(() => {
    lenisRef.current?.resize();
  }, [pathname]);

  // Cursor halo and magnetic buttons.
  useEffect(() => {
    const halo = haloRef.current;
    if (!ready || effects === 'off' || !halo || !finePointer()) return;

    let x = -100, y = -100, hx = -100, hy = -100;
    let frame = 0;
    let magnet: HTMLElement | null = null;

    const release = () => {
      if (magnet) magnet.style.translate = '';
      magnet = null;
    };

    const render = () => {
      hx += (x - hx) * 0.22;
      hy += (y - hy) * 0.22;
      halo.style.transform = `translate3d(${hx}px, ${hy}px, 0)`;
      frame = Math.abs(x - hx) + Math.abs(y - hy) > 0.3 ? requestAnimationFrame(render) : 0;
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      x = event.clientX;
      y = event.clientY;
      halo.dataset.visible = '';
      if (!frame) frame = requestAnimationFrame(render);

      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(INTERACTIVE)) halo.dataset.hover = '';
      else delete halo.dataset.hover;

      const el = target?.closest<HTMLElement>(MAGNETIC) ?? null;
      if (el !== magnet) release();
      if (el && !el.matches(':disabled')) {
        magnet = el;
        const rect = el.getBoundingClientRect();
        const dx = ((x - rect.left) / rect.width - 0.5) * 2;
        const dy = ((y - rect.top) / rect.height - 0.5) * 2;
        el.style.translate = `${(dx * MAX_PULL).toFixed(1)}px ${(dy * MAX_PULL * 0.6).toFixed(1)}px`;
      }
    };
    const onDown = () => (halo.dataset.press = '');
    const onUp = () => delete halo.dataset.press;
    const onLeave = () => {
      delete halo.dataset.visible;
      release();
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('pointerup', onUp, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      release();
      delete halo.dataset.visible;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerup', onUp);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, [ready, effects]);

  return <div ref={haloRef} className="cursor-halo" aria-hidden />;
}
