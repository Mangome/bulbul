import { useThemeStore } from './useThemeStore';
import { useCanvasStore } from './useCanvasStore';
import { loadSettings, saveSettings, type PersistedSettings } from './settingsStorage';

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let initializationPromise: Promise<void> | null = null;

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
    const settings = collectSettings();
    console.log('[Settings] 开始保存配置到磁盘:', settings);
    saveSettings(settings);
  }, 500);
}

/**
 * 初始化设置：从磁盘加载 → 应用到 store → 订阅变更自动保存。
 * 在应用启动时调用一次。防护 React.StrictMode 的重复调用。
 */
export async function initSettings(): Promise<void> {
  // 如果已经在初始化，返回现有的 Promise（防止重复初始化）
  if (initializationPromise) {
    console.log('[Settings] 初始化已进行中，返回现有的 Promise');
    return initializationPromise;
  }

  // 创建初始化 Promise
  initializationPromise = (async () => {
    console.log('[Settings] 开始初始化设置...');
    const saved = await loadSettings();

    // 应用到各 store
    useThemeStore.getState().setTheme(saved.theme);
    useCanvasStore.getState().setZoom(saved.zoomLevel);
    console.log('[Settings] 已应用到 store。theme:', saved.theme, 'zoomLevel:', saved.zoomLevel);

    // 订阅变更，自动持久化
    useThemeStore.subscribe(
      (state, prev) => {
        if (state.theme !== prev.theme) {
          console.log('[Settings] 主题已变更:', prev.theme, '->', state.theme);
          scheduleSave();
        }
      },
    );

    useCanvasStore.subscribe(
      (state, prev) => {
        if (state.zoomLevel !== prev.zoomLevel) {
          console.log('[Settings] 缩放级别已变更:', prev.zoomLevel, '->', state.zoomLevel);
          scheduleSave();
        }
      },
    );
  })();

  return initializationPromise;
}
