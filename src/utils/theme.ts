import { useCallback, useEffect, useState } from 'react';

/**
 * Light / dark colour theme. The site follows the reader's device setting until they use the toggle; after
 * that their choice is remembered on this device. The first paint is handled by the inline script in index.html.
 */
export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'ds-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

/** The reader's saved choice, if they have made one. */
export function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(() => (typeof document === 'undefined' ? 'light' : currentTheme()));

  // Follow the device when it switches (for example at sunset), unless the reader has chosen for themselves
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const onChange = (e: MediaQueryListEvent) => {
      if (savedTheme()) return;
      const next: Theme = e.matches ? 'dark' : 'light';
      applyTheme(next);
      setTheme(next);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* private mode: the choice lasts for this visit only */
      }
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
