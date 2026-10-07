'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { sound } from '@/components/ambience/audio';
import { logActivity } from '@/lib/client/activity';
import { readJSON, writeJSON } from '@/lib/client/storage';

export type FocusMode = 'focus' | 'short' | 'long';

export const MODE_LABEL: Record<FocusMode, string> = {
  focus: 'Focus',
  short: 'Short break',
  long: 'Long break',
};

type Lengths = Record<FocusMode, number>;

type FocusState = {
  mode: FocusMode;
  /** Timestamp the current block ends, while running. */
  endsAt: number | null;
  /** Milliseconds left, while paused. */
  left: number;
  /** Focus blocks completed in this cycle of four. */
  round: number;
  lengths: Lengths;
  /** Set when a block ends, so the UI can say what just happened. */
  justFinished: FocusMode | null;
};

const KEY = 'cq:focus';
const DEFAULT_LENGTHS: Lengths = { focus: 25, short: 5, long: 15 };
const ROUNDS = 4;

const fresh = (lengths: Lengths = DEFAULT_LENGTHS, mode: FocusMode = 'focus'): FocusState => ({
  mode,
  endsAt: null,
  left: lengths[mode] * 60_000,
  round: 0,
  lengths,
  justFinished: null,
});

type Focus = FocusState & {
  running: boolean;
  /** True once a block has been started and not reset. */
  active: boolean;
  total: number;
  remaining: () => number;
  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
  setMode: (mode: FocusMode) => void;
  setLength: (mode: FocusMode, minutes: number) => void;
  dismiss: () => void;
};

const FocusContext = createContext<Focus | null>(null);

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FocusState>(() => fresh());

  // Restore after hydration, so a reload mid-session keeps the timer.
  useEffect(() => {
    const saved = readJSON<FocusState | null>(KEY, null);
    if (saved?.lengths) setState({ ...fresh(saved.lengths), ...saved, justFinished: null });
  }, []);

  const save = useCallback((next: FocusState) => {
    writeJSON(KEY, next);
    return next;
  }, []);

  const remaining = useCallback(
    () => (state.endsAt ? Math.max(0, state.endsAt - Date.now()) : state.left),
    [state.endsAt, state.left]
  );

  const advance = useCallback(
    (prev: FocusState, completed: boolean): FocusState => {
      let round = prev.round;
      let mode: FocusMode;
      if (prev.mode === 'focus') {
        if (completed) logActivity('focus', prev.lengths.focus);
        round += 1;
        mode = round >= ROUNDS ? 'long' : 'short';
      } else {
        if (prev.mode === 'long') round = 0;
        mode = 'focus';
      }
      return save({
        ...prev,
        mode,
        round,
        endsAt: null,
        left: prev.lengths[mode] * 60_000,
        justFinished: completed ? prev.mode : null,
      });
    },
    [save]
  );

  // Fire when the running block ends.
  useEffect(() => {
    if (!state.endsAt) return;
    const id = window.setTimeout(() => {
      sound.chime();
      setState((prev) => (prev.endsAt ? advance(prev, true) : prev));
    }, Math.max(0, state.endsAt - Date.now()));
    return () => window.clearTimeout(id);
  }, [state.endsAt, advance]);

  // Distraction-free page chrome while a focus block runs.
  useEffect(() => {
    const root = document.documentElement;
    if (state.endsAt && state.mode === 'focus') root.dataset.focus = 'on';
    else delete root.dataset.focus;
  }, [state.endsAt, state.mode]);

  const start = useCallback(() => {
    sound.unlock();
    setState((prev) => save({ ...prev, endsAt: Date.now() + prev.left, justFinished: null }));
  }, [save]);

  const pause = useCallback(() => {
    setState((prev) => save({ ...prev, endsAt: null, left: prev.endsAt ? Math.max(0, prev.endsAt - Date.now()) : prev.left }));
  }, [save]);

  const reset = useCallback(() => setState((prev) => save(fresh(prev.lengths))), [save]);
  const skip = useCallback(() => setState((prev) => advance(prev, false)), [advance]);

  const setMode = useCallback(
    (mode: FocusMode) =>
      setState((prev) => save({ ...prev, mode, endsAt: null, left: prev.lengths[mode] * 60_000, justFinished: null })),
    [save]
  );

  const setLength = useCallback(
    (mode: FocusMode, minutes: number) =>
      setState((prev) => {
        const lengths = { ...prev.lengths, [mode]: Math.max(1, Math.min(120, Math.round(minutes))) };
        const idle = !prev.endsAt && prev.mode === mode;
        return save({ ...prev, lengths, left: idle ? lengths[mode] * 60_000 : prev.left });
      }),
    [save]
  );

  const dismiss = useCallback(() => setState((prev) => ({ ...prev, justFinished: null })), []);

  const value = useMemo<Focus>(() => {
    const total = state.lengths[state.mode] * 60_000;
    return {
      ...state,
      running: state.endsAt !== null,
      active: state.endsAt !== null || state.left < total || state.round > 0,
      total,
      remaining,
      start,
      pause,
      reset,
      skip,
      setMode,
      setLength,
      dismiss,
    };
  }, [state, remaining, start, pause, reset, skip, setMode, setLength, dismiss]);

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
}

export function useFocus(): Focus {
  const context = useContext(FocusContext);
  if (!context) throw new Error('useFocus must be used inside <FocusProvider>');
  return context;
}

/** Re-renders every `interval` ms while `on`; returns the current time. */
export function useTicker(on: boolean, interval = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [on, interval]);
  return now;
}

export const formatClock = (ms: number) => {
  const total = Math.ceil(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};
