import { readJSON, writeJSON } from './storage';

export const THEMES = [
  { id: 'dark', label: 'Night library', hint: 'Deep navy and gold' },
  { id: 'light', label: 'Parchment', hint: 'Bright, for daylight' },
  { id: 'sepia', label: 'Sepia reading', hint: 'Warm and easy on the eyes' },
] as const;

export const EFFECTS = [
  { id: 'auto', label: 'Auto', hint: 'Matches your device and motion settings' },
  { id: 'full', label: 'Full', hint: '3D scene and animated ambience' },
  { id: 'lite', label: 'Lite', hint: 'Animated ambience, no 3D' },
  { id: 'off', label: 'Still', hint: 'No motion at all' },
] as const;

export type Theme = (typeof THEMES)[number]['id'];
export type EffectsPref = (typeof EFFECTS)[number]['id'];
export type Effects = Exclude<EffectsPref, 'auto'>;

export type Prefs = {
  theme: Theme;
  ambience: string;
  effects: EffectsPref;
  volume: number;
};

export const PREFS_KEY = 'cq:prefs';

export const DEFAULT_PREFS: Prefs = {
  theme: 'dark',
  ambience: 'library',
  effects: 'auto',
  volume: 0.5,
};

export function loadPrefs(): Prefs {
  return { ...DEFAULT_PREFS, ...readJSON<Partial<Prefs>>(PREFS_KEY, {}) };
}

export function savePrefs(prefs: Prefs): void {
  writeJSON(PREFS_KEY, prefs);
}

/**
 * "Low end" is a conservative guess: data saver on, or 2 GB / 2 cores or less.
 * Those devices get the animated 2D ambience but never the WebGL scene.
 */
export function isLowEndDevice(): boolean {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  if (nav.connection?.saveData) return true;
  if (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) return true;
  return (nav.hardwareConcurrency ?? 8) <= 2;
}

export function resolveEffects(pref: EffectsPref): Effects {
  if (pref !== 'auto') return pref;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'off';
  return isLowEndDevice() ? 'lite' : 'full';
}

/**
 * Runs inline in <head> before first paint, so the stored theme and effects
 * level apply without a flash. Kept dependency-free and tolerant of bad data.
 */
export const BOOT_SCRIPT = `(function(){var d=document.documentElement;try{var p=JSON.parse(localStorage.getItem('${PREFS_KEY}')||'{}');d.dataset.theme=['dark','light','sepia'].indexOf(p.theme)>-1?p.theme:'dark';d.dataset.ambience=p.ambience||'library';var e=p.effects||'auto';if(e==='auto'){var n=navigator,low=(n.connection&&n.connection.saveData)||(n.deviceMemory&&n.deviceMemory<=2)||(n.hardwareConcurrency||8)<=2;e=matchMedia('(prefers-reduced-motion: reduce)').matches?'off':low?'lite':'full'}d.dataset.effects=e}catch(_){d.dataset.theme='dark';d.dataset.effects='full'}})();`;
