/**
 * The six study-room scenes. Everything is procedural: a CSS glow layer keyed
 * on [data-ambience], a 2D canvas particle field and a Web Audio soundscape.
 * No image, video or audio files are shipped.
 */

export type ParticleKind = 'dust' | 'rain' | 'ember' | 'star' | 'snow' | 'firefly';

export type Scene = {
  id: string;
  label: string;
  hint: string;
  particles: ParticleKind;
  /** Particles per million CSS pixels at "full" effects. */
  density: number;
  /** Particle colour on the night theme, and on the two light themes. */
  color: { dark: string; light: string };
};

export const SCENES: Scene[] = [
  {
    id: 'library',
    label: 'Night library',
    hint: 'Dust in lamplight, a quiet room',
    particles: 'dust',
    density: 60,
    color: { dark: '#f2d79c', light: '#9a6b2c' },
  },
  {
    id: 'rain',
    label: 'Rainy window',
    hint: 'Steady rain against the glass',
    particles: 'rain',
    density: 110,
    color: { dark: '#a9c2e6', light: '#4f6688' },
  },
  {
    id: 'hearth',
    label: 'Fireside',
    hint: 'Embers rising from a low fire',
    particles: 'ember',
    density: 45,
    color: { dark: '#ffa45c', light: '#c2571f' },
  },
  {
    id: 'stars',
    label: 'Observatory',
    hint: 'Slow stars and distant chimes',
    particles: 'star',
    density: 120,
    color: { dark: '#e9eeff', light: '#4a5680' },
  },
  {
    id: 'snow',
    label: 'First snow',
    hint: 'Soft snowfall and wind outside',
    particles: 'snow',
    density: 70,
    color: { dark: '#f4f7ff', light: '#8c9ab8' },
  },
  {
    id: 'garden',
    label: 'Night garden',
    hint: 'Fireflies and crickets',
    particles: 'firefly',
    density: 22,
    color: { dark: '#d8f27a', light: '#6b7d1d' },
  },
];

export const sceneById = (id: string): Scene => SCENES.find((s) => s.id === id) ?? SCENES[0];
