import { useThemeStore } from './useThemeStore';
import { useCanvasStore } from './useCanvasStore';
import { useGroupingStore } from './useGroupingStore';
import { useGeoStore } from './useGeoStore';
import { loadSettings, saveSettings, type PersistedSettings } from './settingsStorage';

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let initializationPromise: Promise<void> | null = null;

/** 收集当前需要持久化的设置快照 */
function collectSettings(): PersistedSettings {
  return {
    theme: useThemeStore.getState().theme,
    showDetectionOverlay: useCanvasStore.getState().showDetectionOverlay,
    showImageInfo: useCanvasStore.getState().showImageInfo,
    showHistogram: useCanvasStore.getState().showHistogram,
    similarityThreshold: useGroupingStore.getState().similarityThreshold,
    timeGapSeconds: useGroupingStore.getState().timeGapSeconds,
    province: useGeoStore.getState().selectedProvince,
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
    return initializationPromise;
  }

  // 创建初始化 Promise
  initializationPromise = (async () => {
    const saved = await loadSettings();

    // 应用到各 store
    useThemeStore.getState().setTheme(saved.theme);
    if (saved.showDetectionOverlay) {
      useCanvasStore.getState().toggleDetectionOverlay();
    }
    // store 默认 false：仅当持久化为 true 时翻转为常驻
    if (saved.showImageInfo) {
      useCanvasStore.getState().toggleImageInfo();
    }
    if (saved.showHistogram) {
      useCanvasStore.getState().toggleHistogram();
    }
    useGroupingStore.getState().setSimilarityThreshold(saved.similarityThreshold);
    useGroupingStore.getState().setTimeGapSeconds(saved.timeGapSeconds);
    if (saved.province) {
      useGeoStore.getState().setProvince(saved.province);
    }

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
        if (state.showDetectionOverlay !== prev.showDetectionOverlay
          || state.showImageInfo !== prev.showImageInfo
          || state.showHistogram !== prev.showHistogram) {
          scheduleSave();
        }
      },
    );

    useGroupingStore.subscribe(
      (state, prev) => {
        if (state.similarityThreshold !== prev.similarityThreshold || state.timeGapSeconds !== prev.timeGapSeconds) {
          scheduleSave();
        }
      },
    );

    useGeoStore.subscribe(
      (state, prev) => {
        if (state.selectedProvince !== prev.selectedProvince) {
          scheduleSave();
        }
      },
    );
  })();

  return initializationPromise;
}
