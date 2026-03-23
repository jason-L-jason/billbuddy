import { create } from 'zustand';

interface ThemeState {
  isDark: boolean;
  toggle: () => void;
  setDark: (dark: boolean) => void;
}

function getInitialTheme(): boolean {
  try {
    const saved = localStorage.getItem('billbuddy-theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    // 跟随系统
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

function applyTheme(isDark: boolean) {
  const root = document.documentElement;
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  try {
    localStorage.setItem('billbuddy-theme', isDark ? 'dark' : 'light');
  } catch { /* ignore */ }
}

// 初始化时立即应用
const initialDark = getInitialTheme();
applyTheme(initialDark);

export const useThemeStore = create<ThemeState>((set) => ({
  isDark: initialDark,
  toggle: () => set((state) => {
    const next = !state.isDark;
    applyTheme(next);
    return { isDark: next };
  }),
  setDark: (dark: boolean) => {
    applyTheme(dark);
    set({ isDark: dark });
  },
}));
