'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeName = 'theme-light' | 'theme-dark' | 'theme-navy';

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  isLight: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'theme-light',
  setTheme: () => {},
  isLight: true,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('theme-light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('wh_theme') as ThemeName;
      if (saved && ['theme-light', 'theme-dark', 'theme-navy'].includes(saved)) {
        setThemeState(saved);
        document.documentElement.className = saved;
      } else {
        // Default clean light theme
        setThemeState('theme-light');
        document.documentElement.className = 'theme-light';
      }
    } catch {
      document.documentElement.className = 'theme-light';
    }
    setMounted(true);
  }, []);

  const setTheme = (newTheme: ThemeName) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('wh_theme', newTheme);
      document.documentElement.className = newTheme;
    } catch (e) {
      console.error(e);
    }
  };

  const isLight = theme === 'theme-light';

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isLight }}>
      <div className={`${theme} min-h-screen text-[var(--text-primary)] bg-[var(--bg-primary)] transition-colors duration-150`}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
