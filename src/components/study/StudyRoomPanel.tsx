'use client';

import { Sheet } from '@/components/ui/Sheet';
import { Icon } from '@/components/ui/Icon';
import { EFFECTS, THEMES } from '@/lib/client/prefs';
import { useStudyRoom } from './StudyRoomProvider';

export function StudyRoomPanel() {
  const { prefs, setPref, overlay, close } = useStudyRoom();

  return (
    <Sheet open={overlay === 'room'} onClose={close} label="Study room settings" className="sheet-side">
      <div className="sheet-head">
        <div>
          <div className="eyebrow">Study room</div>
          <h2 className="sheet-title">Set the mood</h2>
        </div>
        <button type="button" className="icon-btn" onClick={close} aria-label="Close settings">
          <Icon name="close" />
        </button>
      </div>

      <fieldset className="choice-group">
        <legend className="label">Theme</legend>
        <div className="theme-choices">
          {THEMES.map((theme) => (
            <label key={theme.id} className="theme-choice" data-swatch={theme.id}>
              <input
                type="radio"
                name="theme"
                value={theme.id}
                checked={prefs.theme === theme.id}
                onChange={() => setPref('theme', theme.id)}
              />
              <span className="theme-swatch" aria-hidden />
              <span className="theme-choice-text">
                <span className="theme-choice-name">{theme.label}</span>
                <span className="xs muted">{theme.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="choice-group">
        <legend className="label">Effects</legend>
        <div className="segmented" role="presentation">
          {EFFECTS.map((effect) => (
            <label key={effect.id} className="segment" title={effect.hint}>
              <input
                type="radio"
                name="effects"
                value={effect.id}
                checked={prefs.effects === effect.id}
                onChange={() => setPref('effects', effect.id)}
              />
              <span>{effect.label}</span>
            </label>
          ))}
        </div>
        <p className="xs muted" style={{ marginTop: 10 }}>
          {EFFECTS.find((e) => e.id === prefs.effects)?.hint}
        </p>
      </fieldset>
    </Sheet>
  );
}
