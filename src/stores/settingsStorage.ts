import {
  readTextFile,
  writeTextFile,
  exists,
  mkdir,
  BaseDirectory,
} from '@tauri-apps/plugin-fs';

import type { Theme } from './useThemeStore';
import type { Province } from '../data/provinces';

/** 持久化设置的结构 */
export interface PersistedSettings {
  theme: Theme;
  showDetectionOverlay: boolean;
  showImageInfo: boolean;
  showHistogram: boolean;
  similarityThreshold: number;
  timeGapSeconds: number;
  province: Province | null;
}

const DEFAULTS: PersistedSettings = {
  theme: 'light',
  showDetectionOverlay: false,
  showImageInfo: false,
  showHistogram: false,
  similarityThreshold: 90.0,
  timeGapSeconds: 10,
  province: null,
};

const SETTINGS_DIR = 'bulbul';
const SETTINGS_FILE = 'bulbul/settings.json';

function isValidProvince(value: unknown): value is Province {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return typeof p.name === 'string'
    && typeof p.lat === 'number'
    && typeof p.lng === 'number';
}

/**
 * 为旧版 Province 数据补全边界框字段。
 * 缺少边界框字段时，用省会坐标推算默认值（lat±2, lng±2）。
 */
function migrateProvince(p: Province): Province {
  const rec = p as unknown as Record<string, unknown>;
  if (
    typeof rec.minLat === 'number' &&
    typeof rec.maxLat === 'number' &&
    typeof rec.minLng === 'number' &&
    typeof rec.maxLng === 'number'
  ) {
    return p;
  }
  return {
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    minLat: p.lat - 2,
    maxLat: p.lat + 2,
    minLng: p.lng - 2,
    maxLng: p.lng + 2,
  };
}

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
      return { ...DEFAULTS };
    }

    const raw = await readTextFile(SETTINGS_FILE, {
      baseDir: BaseDirectory.AppData,
    });
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
    const result = {
      theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : DEFAULTS.theme,
      showDetectionOverlay: typeof parsed.showDetectionOverlay === 'boolean' ? parsed.showDetectionOverlay : DEFAULTS.showDetectionOverlay,
      showImageInfo: typeof parsed.showImageInfo === 'boolean' ? parsed.showImageInfo : DEFAULTS.showImageInfo,
      showHistogram: typeof parsed.showHistogram === 'boolean' ? parsed.showHistogram : DEFAULTS.showHistogram,
      similarityThreshold: typeof parsed.similarityThreshold === 'number' ? parsed.similarityThreshold : DEFAULTS.similarityThreshold,
      timeGapSeconds: typeof parsed.timeGapSeconds === 'number' ? parsed.timeGapSeconds : DEFAULTS.timeGapSeconds,
      province: isValidProvince(parsed.province) ? migrateProvince(parsed.province) : DEFAULTS.province,
    };
    return result;
  } catch (e) {
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
  } catch (e) {
    console.error('[Settings] 保存设置失败:', e);
  }
}
