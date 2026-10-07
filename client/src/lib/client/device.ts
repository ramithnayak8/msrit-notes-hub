let webgl2: boolean | null = null;

/** three.js r163+ requires WebGL2. Probed once, then cached. */
export function supportsWebGL2(): boolean {
  if (webgl2 !== null) return webgl2;
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('webgl2');
    webgl2 = !!ctx;
    ctx?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webgl2 = false;
  }
  return webgl2;
}

export const isCoarsePointer = () => window.matchMedia('(pointer: coarse)').matches;
