'use client';

import { useEffect } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Icon } from '@/components/ui/Icon';
import { summarise, useActivity } from '@/lib/client/activity';
import { useStudyRoom } from './StudyRoomProvider';
import { formatClock, MODE_LABEL, useFocus, useTicker, type FocusMode } from './FocusProvider';

const MODES: FocusMode[] = ['focus', 'short', 'long'];
const RING = 2 * Math.PI * 92;

const FINISHED: Record<FocusMode, string> = {
  focus: 'Session complete. Stretch, drink some water, then come back.',
  short: 'Break over. Back to the books.',
  long: 'Long break over. A fresh cycle starts now.',
};

/** Pomodoro timer: 4 focus blocks with short breaks, then a long break. */
export function FocusPanel() {
  const { overlay, close } = useStudyRoom();
  const focus = useFocus();
  const isOpen = overlay === 'focus';
  useTicker(isOpen && focus.running);
  const left = focus.remaining();
  const progress = 1 - left / focus.total;
  const { days } = useActivity();
  const streak = summarise(days);

  return (
    <Sheet open={isOpen} onClose={close} label="Focus timer" className="sheet-side">
      <div className="sheet-head">
        <div>
          <div className="eyebrow">Focus mode</div>
          <h2 className="sheet-title">Sit with one thing</h2>
        </div>
        <button type="button" className="icon-btn" onClick={close} aria-label="Close focus timer">
          <Icon name="close" />
        </button>
      </div>

      <div className="segmented" role="radiogroup" aria-label="Timer mode">
        {MODES.map((mode) => (
          <label key={mode} className="segment">
            <input type="radio" name="focus-mode" checked={focus.mode === mode} onChange={() => focus.setMode(mode)} />
            <span>{MODE_LABEL[mode]}</span>
          </label>
        ))}
      </div>

      <div className="focus-dial" data-mode={focus.mode}>
        <svg viewBox="0 0 200 200" aria-hidden>
          <circle cx="100" cy="100" r="92" className="focus-dial-track" />
          <circle
            cx="100"
            cy="100"
            r="92"
            className="focus-dial-fill"
            strokeDasharray={RING}
            strokeDashoffset={RING * (1 - progress)}
          />
        </svg>
        <div className="focus-dial-text">
          <span className="focus-clock nums" role="timer" aria-live="off">{formatClock(left)}</span>
          <span className="label">{MODE_LABEL[focus.mode]}</span>
        </div>
      </div>

      <div className="focus-rounds" aria-label={`${focus.round} of 4 focus sessions done`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`focus-round${i < focus.round ? ' is-done' : ''}`} />
        ))}
      </div>

      {focus.justFinished && (
        <p className="notice focus-notice" role="status">
          {FINISHED[focus.justFinished]}
        </p>
      )}

      <div className="row gap-10 focus-controls">
        {focus.running ? (
          <button type="button" className="btn btn-primary grow" onClick={focus.pause}>
            <Icon name="pause" size={17} /> Pause
          </button>
        ) : (
          <button type="button" className="btn btn-primary grow" onClick={focus.start} data-magnetic>
            <Icon name="play" size={17} /> {focus.active && focus.left < focus.total ? 'Resume' : 'Start'}
          </button>
        )}
        <button type="button" className="icon-btn icon-btn-lg" onClick={focus.skip} aria-label="Skip to next block" title="Skip">
          <Icon name="skip" />
        </button>
        <button type="button" className="icon-btn icon-btn-lg" onClick={focus.reset} aria-label="Reset timer" title="Reset">
          <Icon name="reset" />
        </button>
      </div>

      <fieldset className="choice-group" style={{ marginTop: 'var(--space-8)' }}>
        <legend className="label">Lengths (minutes)</legend>
        <div className="focus-lengths">
          {MODES.map((mode) => (
            <label key={mode} className="focus-length">
              <span className="xs muted">{MODE_LABEL[mode]}</span>
              <input
                type="number"
                min={1}
                max={120}
                inputMode="numeric"
                value={focus.lengths[mode]}
                onChange={(e) => e.target.value && focus.setLength(mode, Number(e.target.value))}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <div className="focus-stats">
        <div>
          <span className="focus-stat-value nums"><Icon name="flame" size={18} /> {streak.current}</span>
          <span className="xs muted">day streak</span>
        </div>
        <div>
          <span className="focus-stat-value nums">{streak.focusToday}</span>
          <span className="xs muted">minutes today</span>
        </div>
        <div>
          <span className="focus-stat-value nums">{streak.focusWeek}</span>
          <span className="xs muted">this week</span>
        </div>
      </div>
      <p className="xs muted" style={{ marginTop: 12 }}>
        While a focus block runs, the page chrome dims so only your reading stays bright.
      </p>
    </Sheet>
  );
}

/** Floating timer, visible on every page while a session is under way. */
export function FocusPill() {
  const { overlay, open } = useStudyRoom();
  const focus = useFocus();
  const now = useTicker(focus.running, 500);
  const left = focus.remaining();

  // Show the countdown in the tab title, so it is visible from other tabs.
  useEffect(() => {
    if (!focus.running) return;
    const base = document.title.replace(/^\d\d:\d\d · /, '');
    document.title = `${formatClock(left)} · ${base}`;
  }, [focus.running, left, now]);
  useEffect(() => {
    if (!focus.running) document.title = document.title.replace(/^\d\d:\d\d · /, '');
  }, [focus.running]);

  if (!focus.active || overlay === 'focus') return null;

  return (
    <div className="focus-pill" data-mode={focus.mode} data-running={focus.running || undefined}>
      <button type="button" className="focus-pill-main" onClick={() => open('focus')} aria-label="Open focus timer">
        <Icon name="timer" size={16} />
        <span className="nums">{formatClock(left)}</span>
        <span className="focus-pill-mode">{focus.justFinished ? 'Done' : MODE_LABEL[focus.mode]}</span>
      </button>
      <button
        type="button"
        className="focus-pill-toggle"
        onClick={focus.running ? focus.pause : focus.start}
        aria-label={focus.running ? 'Pause timer' : 'Start timer'}
      >
        <Icon name={focus.running ? 'pause' : 'play'} size={14} />
      </button>
    </div>
  );
}
