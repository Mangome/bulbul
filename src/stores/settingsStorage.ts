import {
  readTextFile,
  writeTextFile,
  exists,
  mkdir,
  BaseDirectory,
} from '@tauri-apps/plugin-fs';

import type { Theme } from './useThemeStore';

/** 持久化设置的结构 */
export interface PersistedSettings {
  zoomLevel: number;
  theme: Theme;
}

const DEFAULTS: PersistedSettings = {
  zoomLevel: 1.0,
  theme: 'light',
};

const SETTINGS_DIR = 'bulbul';
const SETTINGS_FILE = 'bulbul/settings.json';

/**
 * 从磁盘加载设置（$APPDATA/bulbul/settings.json）。
 * 文件不存在或解析失败时返回默认值。
 */
export async function loadSettings(): Promise<PersistedSettings> {
  try {
    const fileExists = await exists(SETTINGS_FILE, {
      baseDir: BaseDirectory.AppData,
    });
    if (!fileExists) {
      console.log('[Settings] 配置文件不存在，使用默认值');
      return { ...DEFAULTS };
    }

    const raw = await readTextFile(SETTINGS_FILE, {
      baseDir: BaseDirectory.AppData,
    });
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
    const result = {
      zoomLevel: typeof parsed.zoomLevel === 'number' ? parsed.zoomLevel : DEFAULTS.zoomLevel,
      theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : DEFAULTS.theme,
    };
    console.log('[Settings] 成功加载配置:', result);
    return result;
  } catch (e) {
    console.warn('[Settings] 加载设置失败，使用默认值:', e);
    return { ...DEFAULTS };
  }
}

/**
 * 将设置写入磁盘。自动创建目录。
 */
export async function saveSettings(settings: PersistedSettings): Promise<void> {
  try {
    const dirExists = await exists(SETTINGS_DIR, {
      baseDir: BaseDirectory.AppData,
    });
    if (!dirExists) {
      await mkdir(SETTINGS_DIR, {
        baseDir: BaseDirectory.AppData,
        recursive: true,
      });
    }

    await writeTextFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), {
      baseDir: BaseDirectory.AppData,
    });
    console.log('[Settings] 配置已保存:', settings);
  } catch (e) {
    console.error('[Settings] 保存设置失败:', e);
  }
}
