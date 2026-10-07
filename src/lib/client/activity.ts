import { createStore } from './store';

/**
 * Study activity per local calendar day. A day counts towards the streak when
 * you open a course or finish a focus session on it.
 */
type Day = { visits: number; focusMin: number };
type Activity = { days: Record<string, Day> };

const KEEP_DAYS = 120;

const store = createStore<Activity>('cq:activity', { days: {} });

export const useActivity = store.use;

/** YYYY-MM-DD in local time; `offset` days back from `from`. */
export function dayKey(offset = 0, from = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function logActivity(kind: 'visit' | 'focus', amount = 1): void {
  store.set(({ days }) => {
    const today = dayKey();
    const prev = days[today] ?? { visits: 0, focusMin: 0 };
    const next: Record<string, Day> = {
      [today]: kind === 'visit' ? { ...prev, visits: prev.visits + amount } : { ...prev, focusMin: prev.focusMin + amount },
    };
    const oldest = dayKey(KEEP_DAYS);
    for (const [key, value] of Object.entries(days)) {
      if (key !== today && key >= oldest) next[key] = value;
    }
    return { days: next };
  });
}

export type StreakSummary = {
  current: number;
  longest: number;
  activeToday: boolean;
  focusToday: number;
  focusWeek: number;
};

export function summarise(days: Record<string, Day>, now = new Date()): StreakSummary {
  const active = (offset: number) => !!days[dayKey(offset, now)];
  const activeToday = active(0);

  // Today still counts as "in progress", so an unbroken run up to yesterday is kept.
  let current = 0;
  for (let i = activeToday ? 0 : 1; active(i); i++) current++;

  let longest = 0;
  let run = 0;
  for (let i = KEEP_DAYS; i >= 0; i--) {
    run = active(i) ? run + 1 : 0;
    longest = Math.max(longest, run);
  }

  let focusWeek = 0;
  for (let i = 0; i < 7; i++) focusWeek += days[dayKey(i, now)]?.focusMin ?? 0;

  return { current, longest, activeToday, focusToday: days[dayKey(0, now)]?.focusMin ?? 0, focusWeek };
}
