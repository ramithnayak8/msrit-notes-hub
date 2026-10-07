/**
 * Small fuzzy matcher for the command palette. A contiguous match beats a
 * scattered one, matches at word starts beat mid-word ones, and every query
 * character must appear in order. Returns null when it does not match.
 */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const t = text.toLowerCase();

  const at = t.indexOf(q);
  if (at >= 0) {
    const wordStart = at === 0 || /[\s\-/(]/.test(t[at - 1]);
    return 1000 - at + (wordStart ? 200 : 0) - t.length * 0.5;
  }

  let score = 0;
  let from = 0;
  let streak = 0;
  for (const ch of q) {
    if (ch === ' ') continue;
    const found = t.indexOf(ch, from);
    if (found < 0) return null;
    streak = found === from ? streak + 1 : 0;
    const wordStart = found === 0 || /[\s\-/(]/.test(t[found - 1]);
    score += 1 + streak * 3 + (wordStart ? 6 : 0) - Math.min(found - from, 10) * 0.3;
    from = found + 1;
  }
  return score;
}

/** Best score across several fields of one item. */
export function bestScore(query: string, fields: string[]): number | null {
  let best: number | null = null;
  for (const field of fields) {
    const score = fuzzyScore(query, field);
    if (score !== null && (best === null || score > best)) best = score;
  }
  return best;
}
