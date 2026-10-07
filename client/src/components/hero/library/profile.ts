/** Scene budgets. Phones get fewer objects and no post-processing. */

export type SceneProfile = {
  books: number;
  pages: number;
  dust: number;
  postprocessing: boolean;
  maxDpr: number;
  /** Horizontal spread of objects; narrower on portrait phones so they stay in frame. */
  spread: number;
};

export const DESKTOP: SceneProfile = { books: 72, pages: 14, dust: 1400, postprocessing: true, maxDpr: 2, spread: 1 };
export const MOBILE: SceneProfile = { books: 34, pages: 6, dust: 450, postprocessing: false, maxDpr: 1.5, spread: 0.45 };

/** Shared mutable input, written by DOM listeners and read every frame (no React renders). */
export type SceneInput = {
  /** 0 at the top of the hero, 1 once it has scrolled out of view. */
  scroll: number;
  /** Pointer position normalised to -1..1. */
  pointerX: number;
  pointerY: number;
};

/** Where the light comes from: a tall window up and to the right. */
export const LIGHT_DIRECTION: [number, number, number] = [-0.55, -1, 0.28];
export const LIGHT_COLOR = '#ffd49a';
export const BACKGROUND = '#0a0f1e';

/** Small deterministic PRNG so the arrangement is identical on every visit. */
export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
