'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeName = 'theme-navy' | 'theme-slate' | 'theme-charcoal';

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'theme-navy',
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('theme-navy');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('wh_theme') as ThemeName;
      if (saved && ['theme-navy', 'theme-slate', 'theme-charcoal'].includes(saved)) {
        setThemeState(saved);
        document.documentElement.className = saved;
      } else {
        document.documentElement.className = 'theme-navy';
      }
    } catch {
      document.documentElement.className = 'theme-navy';
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

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div className={`${theme} min-h-screen text-[var(--text-primary)] bg-[var(--bg-primary)]`}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

