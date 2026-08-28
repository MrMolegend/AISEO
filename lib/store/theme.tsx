'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { STORAGE_KEYS } from './storage';
import { createMediaStore, createStringStore } from './local-store';

export type ThemeChoice = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: ThemeChoice;
  /** What is actually on screen once "system" has been resolved. */
  resolved: 'light' | 'dark';
  setTheme: (theme: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const themeStore = createStringStore(STORAGE_KEYS.theme, 'system');
const darkMedia = createMediaStore('(prefers-color-scheme: dark)');

/**
 * Runs before paint, so the page never flashes light before switching to dark.
 * Kept in sync with the effect below — both write the same class.
 */
export const themeBootstrapScript = `
(function(){try{
  var stored = localStorage.getItem('${STORAGE_KEYS.theme}');
  var dark = stored === 'dark' || ((!stored || stored === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}catch(e){}})();
`;

function isThemeChoice(value: string): value is ThemeChoice {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const stored = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getSnapshot,
    themeStore.getServerSnapshot,
  );
  const prefersDark = useSyncExternalStore(
    darkMedia.subscribe,
    darkMedia.getSnapshot,
    darkMedia.getServerSnapshot,
  );

  const theme: ThemeChoice = isThemeChoice(stored) ? stored : 'system';
  const resolved: 'light' | 'dark' =
    theme === 'dark' || (theme === 'system' && prefersDark) ? 'dark' : 'light';

  // Writing a class onto <html> is exactly what an effect is for: pushing React
  // state out to something React does not own.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  }, [resolved]);

  const setTheme = useCallback((next: ThemeChoice) => themeStore.set(next), []);

  const value = useMemo(
    () => ({ theme, resolved, setTheme }),
    [theme, resolved, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
