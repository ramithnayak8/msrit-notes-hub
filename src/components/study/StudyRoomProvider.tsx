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
      root.dataset.theme = prefs.theme;
      root.dataset.ambience = prefs.ambience;
      root.dataset.effects = resolved;
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
