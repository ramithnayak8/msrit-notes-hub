import { useSyncExternalStore } from 'react';
import { onStorageKey, readJSON, writeJSON } from './storage';

/**
 * A tiny localStorage-backed store for React. Snapshots are cached so
 * useSyncExternalStore sees a stable reference until something writes, and
 * writes from other tabs arrive through the storage event.
 */
export function createStore<T extends object>(key: string, fallback: T) {
  let cache: T | null = null;
  const listeners = new Set<() => void>();
  let offStorage: (() => void) | null = null;

  const get = (): T => {
    if (cache === null) cache = { ...fallback, ...readJSON<Partial<T>>(key, {}) };
    return cache;
  };
  const emit = () => listeners.forEach((listener) => listener());

  const set = (update: (prev: T) => T) => {
    cache = update(get());
    writeJSON(key, cache);
    emit();
  };

  // One cross-tab listener, shared by every subscriber.
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    if (!offStorage) {
      offStorage = onStorageKey(key, () => {
        cache = null;
        emit();
      });
    }
    return () => {
      listeners.delete(listener);
      if (!listeners.size && offStorage) {
        offStorage();
        offStorage = null;
      }
    };
  };

  const useStore = (): T => useSyncExternalStore(subscribe, get, () => fallback);

  return { get, set, use: useStore };
}
