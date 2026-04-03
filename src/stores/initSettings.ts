import { useThemeStore } from './useThemeStore';
import { useCanvasStore } from './useCanvasStore';
import { loadSettings, saveSettings, type PersistedSettings } from './settingsStorage';

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** 收集当前需要持久化的设置快照 */
function collectSettings(): PersistedSettings {
  return {
    theme: useThemeStore.getState().theme,
    zoomLevel: useCanvasStore.getState().zoomLevel,
  };
}

/** 防抖写入（500ms） */
function scheduleSave() {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveSettings(collectSettings());
  }, 500);
}

/**
 * 初始化设置：从磁盘加载 → 应用到 store → 订阅变更自动保存。
 * 在应用启动时调用一次。
 */
export async function initSettings(): Promise<void> {
  const saved = await loadSettings();

  // 应用到各 store
  useThemeStore.getState().setTheme(saved.theme);
  useCanvasStore.getState().setZoom(saved.zoomLevel);

  // 订阅变更，自动持久化
  useThemeStore.subscribe(
    (state, prev) => {
      if (state.theme !== prev.theme) {
        scheduleSave();
      }
    },
  );

  useCanvasStore.subscribe(
    (state, prev) => {
      if (state.zoomLevel !== prev.zoomLevel) {
        scheduleSave();
      }
    },
  );
}
