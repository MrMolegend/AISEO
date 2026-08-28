'use client';

import { readJson, writeJson } from './storage';

/**
 * A tiny external store backed by localStorage, shaped for
 * `useSyncExternalStore`.
 *
 * Persisted state cannot live in `useState`: the server has no localStorage, so
 * the first client render has to match the server's empty state and only then
 * pick up what was stored. Doing that with an effect means setting state during
 * an effect, which React now warns about. An external store is the sanctioned
 * answer — the snapshot starts as the server's, hydrates on first subscribe,
 * and every later write notifies subscribers directly.
 */
export interface LocalStore<T> {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  /** True once localStorage has been read. */
  isHydrated: () => boolean;
  update: (updater: (current: T) => T) => void;
  reset: (next: T) => void;
}

export function createLocalStore<T extends object>(
  key: string,
  initial: T,
  /** Lets a store repair a snapshot written by an older version. */
  migrate: (stored: Partial<T>, initial: T) => T = (stored, base) => ({
    ...base,
    ...stored,
  }),
): LocalStore<T> {
  let snapshot: T = initial;
  let hydrated = false;
  const listeners = new Set<() => void>();

  function emit() {
    for (const listener of listeners) listener();
  }

  function hydrate() {
    if (hydrated) return;
    hydrated = true;
    const stored = readJson<Partial<T>>(key, {});
    snapshot = migrate(stored, initial);
    emit();
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      // The first subscriber arrives after mount, which is the earliest point
      // localStorage may be read without risking a hydration mismatch.
      hydrate();
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initial,
    isHydrated: () => hydrated,
    update(updater) {
      snapshot = updater(snapshot);
      writeJson(key, snapshot);
      emit();
    },
    reset(next) {
      snapshot = next;
      writeJson(key, snapshot);
      emit();
    },
  };
}

/** The same idea for a single string value, used by the theme. */
export function createStringStore(key: string, fallback: string) {
  let snapshot = fallback;
  let hydrated = false;
  const listeners = new Set<() => void>();

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (!hydrated) {
        hydrated = true;
        try {
          snapshot = window.localStorage.getItem(key) ?? fallback;
        } catch {
          snapshot = fallback;
        }
        for (const item of listeners) item();
      }
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => fallback,
    set(value: string) {
      snapshot = value;
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Storage disabled — the choice still applies for this session.
      }
      for (const listener of listeners) listener();
    },
  };
}

/** Subscribes to a media query, again in `useSyncExternalStore` shape. */
export function createMediaStore(query: string) {
  return {
    subscribe(listener: () => void) {
      if (typeof window === 'undefined') return () => {};
      const media = window.matchMedia(query);
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    },
    getSnapshot: () =>
      typeof window === 'undefined' ? false : window.matchMedia(query).matches,
    getServerSnapshot: () => false,
  };
}
