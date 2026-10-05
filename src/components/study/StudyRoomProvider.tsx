'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_PREFS,
  loadPrefs,
  resolveEffects,
  savePrefs,
  type Effects,
  type Prefs,
} from '@/lib/client/prefs';
import { consumeIntro } from '@/lib/client/intro';

export type Overlay = 'palette' | 'room' | 'focus' | null;

type StudyRoom = {
  prefs: Prefs;
  /** The effects level actually in use once "auto" is resolved against the device. */
  effects: Effects;
  ready: boolean;
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  overlay: Overlay;
  open: (overlay: Exclude<Overlay, null>) => void;
  close: () => void;
};

const StudyRoomContext = createContext<StudyRoom | null>(null);

export function StudyRoomProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [effects, setEffects] = useState<Effects>('full');
  const [ready, setReady] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);

  useEffect(() => {
    setPrefs(loadPrefs());
    setReady(true);
    return consumeIntro();
  }, []);

  // The boot script already applied stored values before paint; from here on
  // the provider owns the attributes. Skipped until stored prefs have loaded so
  // defaults never overwrite them.
  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    const apply = () => {
      const resolved = resolveEffects(prefs.effects);
      setEffects(resolved);
      // Writing an unchanged attribute on <html> still restyles the whole page.
      const set = (key: string, value: string) => {
        if (root.dataset[key] !== value) root.dataset[key] = value;
      };
      set('theme', prefs.theme);
      set('ambience', prefs.ambience);
      set('effects', resolved);
    };
    apply();
    savePrefs(prefs);

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    motion.addEventListener('change', apply);
    return () => motion.removeEventListener('change', apply);
  }, [prefs, ready]);

  const setPref = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  }, []);

  const open = useCallback((next: Exclude<Overlay, null>) => setOverlay(next), []);
  const close = useCallback(() => setOverlay(null), []);

  const value = useMemo(
    () => ({ prefs, effects, ready, setPref, overlay, open, close }),
    [prefs, effects, ready, setPref, overlay, open, close]
  );

  return <StudyRoomContext.Provider value={value}>{children}</StudyRoomContext.Provider>;
}

export function useStudyRoom(): StudyRoom {
  const context = useContext(StudyRoomContext);
  if (!context) throw new Error('useStudyRoom must be used inside <StudyRoomProvider>');
  return context;
}
