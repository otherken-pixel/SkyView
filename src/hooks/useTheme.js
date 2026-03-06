import { useState, useEffect } from 'react';
import { setStatusBarStyle } from '../services/capacitor';

const THEME_CYCLE = ['dark', 'light', 'night'];
const STORAGE_KEY = 'flightscore_theme_manual';

/**
 * React hook for three-way theme management (dark / light / night).
 *
 * - Persists the user's explicit choice in localStorage under
 *   `flightscore_theme_manual`.
 * - Applies the corresponding CSS class (`dark-theme`, `light-theme`, or
 *   `night-theme`) to `document.documentElement` and `document.body`.
 * - Falls back to the system colour-scheme preference when no manual
 *   override has been saved, and tracks system changes in real time.
 *
 * @returns {{
 *   theme: 'dark' | 'light' | 'night',
 *   setTheme: (t: 'dark' | 'light' | 'night') => void,
 *   cycleTheme: () => void,
 * }}
 */
export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    try {
      const manual = localStorage.getItem(STORAGE_KEY);
      if (manual === 'dark' || manual === 'light' || manual === 'night') return manual;
    } catch {
      // localStorage may be unavailable
    }
    // No explicit preference — follow system
    const prefersDark = !!(
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
    return prefersDark ? 'dark' : 'light';
  });

  /**
   * Set the theme explicitly and persist the choice.
   * @param {'dark'|'light'|'night'} next
   */
  function setTheme(next) {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }

  /**
   * Cycle to the next theme in the sequence: dark -> light -> night -> dark.
   */
  function cycleTheme() {
    setThemeState((prev) => {
      const idx = THEME_CYCLE.indexOf(prev);
      const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }

  // Apply CSS class to <html> and <body> whenever theme changes
  useEffect(() => {
    const classes = THEME_CYCLE.map((t) => t + '-theme');
    document.documentElement.classList.remove(...classes);
    document.documentElement.classList.add(theme + '-theme');
    document.body.classList.remove(...classes);
    document.body.classList.add(theme + '-theme');
    // Sync native status bar style on mobile
    setStatusBarStyle(theme);
  }, [theme]);

  // Auto-follow system preference changes when no manual override is saved
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    function onSystemChange(e) {
      try {
        if (!localStorage.getItem(STORAGE_KEY)) {
          setThemeState(e.matches ? 'dark' : 'light');
        }
      } catch {
        // ignore
      }
    }
    mq.addEventListener('change', onSystemChange);
    return () => mq.removeEventListener('change', onSystemChange);
  }, []);

  return { theme, setTheme, cycleTheme };
}
