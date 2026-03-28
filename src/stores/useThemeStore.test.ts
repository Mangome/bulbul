import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from './useThemeStore';

describe('useThemeStore', () => {
  beforeEach(() => {
    // 重置 store 状态
    useThemeStore.setState({ theme: 'light' });
    document.documentElement.dataset.theme = '';
  });

  it('初始主题应为 light', () => {
    const { theme } = useThemeStore.getState();
    expect(theme).toBe('light');
  });

  it('toggleTheme 应切换为 dark', () => {
    useThemeStore.getState().toggleTheme();
    const { theme } = useThemeStore.getState();
    expect(theme).toBe('dark');
  });

  it('toggleTheme 两次应恢复为 light', () => {
    const store = useThemeStore.getState();
    store.toggleTheme();
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe('light');
  });

  it('toggleTheme 应同步 DOM data-theme 属性', () => {
    useThemeStore.getState().toggleTheme();
    expect(document.documentElement.dataset.theme).toBe('dark');

    useThemeStore.getState().toggleTheme();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('setTheme 应直接设置指定主题', () => {
    useThemeStore.getState().setTheme('dark');
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('setTheme 设置相同主题不应报错', () => {
    useThemeStore.getState().setTheme('light');
    expect(useThemeStore.getState().theme).toBe('light');
  });
});
