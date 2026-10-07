/**
 * localStorage that never throws. Private windows, blocked site data and
 * quota errors all degrade to "nothing stored" instead of breaking the page.
 */

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: keep working in memory */
  }
}

/** Subscribe to writes from other tabs, so shelves stay in sync across windows. */
export function onStorageKey(key: string, callback: () => void): () => void {
  const handler = (event: StorageEvent) => {
    if (event.key === key) callback();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
