import { createContext, useContext, useState, useEffect } from 'react';
import type { ThemeName, ThemeConfig } from './themes';
import { themes, loadTheme, saveTheme } from './themes';

interface ThemeContextValue {
  theme: ThemeConfig;
  themeName: ThemeName;
  setTheme: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>(loadTheme);

  useEffect(() => {
    saveTheme(themeName);
  }, [themeName]);

  const value: ThemeContextValue = {
    theme: themes[themeName],
    themeName,
    setTheme: setThemeName,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider');
  return ctx;
}
