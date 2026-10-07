/** The intro plays once per browser session; any page load consumes it. */

const KEY = 'cq:intro';
export const INTRO_MS = 1500;

export function endIntro(): void {
  delete document.documentElement.dataset.intro;
}

/** Called once on app start: mark the session and end the intro after it has played. */
export function consumeIntro(): () => void {
  try {
    window.sessionStorage.setItem(KEY, '1');
  } catch {
    /* no session storage: the intro may replay, which is harmless */
  }
  if (!document.documentElement.dataset.intro) return () => {};
  const id = window.setTimeout(endIntro, INTRO_MS);
  return () => window.clearTimeout(id);
}

export const INTRO_BOOT = `try{if(!sessionStorage.getItem('${KEY}'))document.documentElement.dataset.intro='1'}catch(_){}`;
