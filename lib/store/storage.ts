/**
 * localStorage with the sharp edges removed: it is unavailable during server
 * rendering, throws in private-mode Safari, and can contain a value written by
 * an older version of the app. Every read is therefore guarded and falls back
 * to the caller's default.
 */

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage disabled — the demo still works in memory.
  }
}

export function readString(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeString(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignored, as above.
  }
}

export const STORAGE_KEYS = {
  demo: 'tutorhub.demo.v1',
  theme: 'tutorhub.theme.v1',
} as const;
