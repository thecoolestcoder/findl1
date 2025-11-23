// src/hooks/useDarkMode.js
import { useState, useEffect, useCallback } from 'react';

const THEME_KEY = 'findlee_theme'; // 'system' | 'dark' | 'light'

export default function useDarkMode() {
  const [themeMode, setThemeMode] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) || 'system';
    } catch {
      return 'system';
    }
  });

  const prefersDarkMedia =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;

  const isSystemDark = prefersDarkMedia ? prefersDarkMedia.matches : false;
  const isDarkMode = themeMode === 'dark' || (themeMode === 'system' && isSystemDark);

  // React to OS changes if following system preference
  useEffect(() => {
    if (!prefersDarkMedia) return;
    const handler = () => {
      if (localStorage.getItem(THEME_KEY) === 'system') {
        setThemeMode(prev => prev); // trigger rerender
      }
    };
    prefersDarkMedia.addEventListener
      ? prefersDarkMedia.addEventListener('change', handler)
      : prefersDarkMedia.addListener(handler);

    return () => {
      prefersDarkMedia.removeEventListener
        ? prefersDarkMedia.removeEventListener('change', handler)
        : prefersDarkMedia.removeListener(handler);
    };
  }, [prefersDarkMedia]);

  const toggleDarkMode = useCallback(() => {
    const next = isDarkMode ? 'light' : 'dark';
    setThemeMode(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
  }, [isDarkMode]);

  const useSystemPreference = useCallback(() => {
    setThemeMode('system');
    try { localStorage.setItem(THEME_KEY, 'system'); } catch (e) {}
  }, []);

  return { isDarkMode, themeMode, toggleDarkMode, useSystemPreference };
}
