'use client';

import { Sheet } from '@/components/ui/Sheet';
import { Icon } from '@/components/ui/Icon';
import { SCENES } from '@/components/ambience/scenes';
import { EFFECTS, THEMES } from '@/lib/client/prefs';
import { useStudyRoom } from './StudyRoomProvider';

export function StudyRoomPanel() {
  const { prefs, setPref, sound, setSound, overlay, close } = useStudyRoom();

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
        <legend className="label">Ambience</legend>
        <div className="scene-choices">
          {SCENES.map((scene) => (
            <label key={scene.id} className="scene-choice" data-scene={scene.id} title={scene.hint}>
              <input
                type="radio"
                name="ambience"
                value={scene.id}
                checked={prefs.ambience === scene.id}
                onChange={() => setPref('ambience', scene.id)}
              />
              <span className="scene-swatch" aria-hidden />
              <span className="scene-choice-name">{scene.label}</span>
            </label>
          ))}
        </div>
        <p className="xs muted" style={{ marginTop: 10 }}>
          {SCENES.find((s) => s.id === prefs.ambience)?.hint ?? SCENES[0].hint}
        </p>
      </fieldset>

      <fieldset className="choice-group">
        <legend className="label">Sound</legend>
        <div className="sound-row">
          <button
            type="button"
            className={`icon-btn icon-btn-lg${sound ? ' is-live' : ''}`}
            aria-pressed={sound}
            aria-label={sound ? 'Turn ambient sound off' : 'Turn ambient sound on'}
            onClick={() => setSound(!sound)}
          >
            <Icon name={sound ? 'volume' : 'volumeOff'} />
          </button>
          <label className="sound-slider">
            <span className="visually-hidden">Volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={prefs.volume}
              onChange={(e) => {
                setPref('volume', Number(e.target.value));
                if (!sound) setSound(true);
              }}
              style={{ '--fill': `${prefs.volume * 100}%` } as React.CSSProperties}
            />
          </label>
          <span className="xs muted nums" style={{ width: 34, textAlign: 'right' }}>{Math.round(prefs.volume * 100)}%</span>
        </div>
        <p className="xs muted" style={{ marginTop: 10 }}>
          Generated live in your browser to match the scene. Nothing is downloaded.
        </p>
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
