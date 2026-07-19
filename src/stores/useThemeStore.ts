import { create } from 'zustand';

export type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

/**
 * 系统偏好探测：无保存设置时的初始猜测。
 * 用户显式选择由 initSettings 从磁盘恢复并覆盖此值；
 * jsdom 等无 matchMedia 环境回退 light。
 */
function getSystemPreferredTheme(): Theme {
  if (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }
  return 'light';
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: getSystemPreferredTheme(),

  toggleTheme: () =>
    set((state) => {
      const next: Theme = state.theme === 'light' ? 'dark' : 'light';
      applyTheme(next);
      return { theme: next };
    }),

  setTheme: (theme: Theme) => {
    applyTheme(theme);
    set({ theme });
  },
}));

// 模块加载即同步 DOM：让首帧渲染前 data-theme 就位，避免主题闪烁
applyTheme(useThemeStore.getState().theme);
