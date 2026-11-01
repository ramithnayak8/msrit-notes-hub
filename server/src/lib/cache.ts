/**
 * A small time-boxed, in-process cache for read-heavy endpoints (insights,
 * search, the assistant's statistics): the corpus only changes when a paper is
 * ingested, and in exam week many students ask for the same course or topic.
 * It holds the promise, so concurrent requests for an expired key share one
 * computation, a failure is never cached, and a hit moves the key to the back
 * (least recently used goes first). Keys are namespaced by the caller.
 */
const CACHE_MS = 60_000;
const CACHE_MAX = 500;
const cache = new Map<string, { at: number; value: Promise<unknown> }>();

export function cached<T>(key: string, compute: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  cache.delete(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    cache.set(key, hit);
    return hit.value as Promise<T>;
  }
  while (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  const value = compute();
  cache.set(key, { at: Date.now(), value });
  value.catch(() => cache.get(key)?.value === value && cache.delete(key)); // never cache a failure
  return value;
}
