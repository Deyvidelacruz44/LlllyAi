import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  resolved: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  init: () => void;
}

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const applyTheme = (resolved: 'light' | 'dark') => {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'system',
  resolved: 'light',

  setTheme: (theme) => {
    const resolved = theme === 'system' ? getSystemTheme() : theme;
    applyTheme(resolved);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('lilly-theme', theme);
    }
    set({ theme, resolved });
  },

  init: () => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('lilly-theme') as Theme | null;
    const theme = saved || 'system';
    const resolved = theme === 'system' ? getSystemTheme() : theme;
    applyTheme(resolved);
    set({ theme, resolved });

    // Listen for system theme changes
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const current = get().theme;
      if (current === 'system') {
        const newResolved = getSystemTheme();
        applyTheme(newResolved);
        set({ resolved: newResolved });
      }
    };
    mql.addEventListener('change', handler);
  },
}));
