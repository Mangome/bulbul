import { invoke } from '@tauri-apps/api/core';

/** 缓存大小信息 */
export interface CacheSizeInfo {
  totalSize: number;
  fileCount: number;
  cacheDir: string;
}

/** 查询缓存大小和文件数量 */
export async function getCacheSize(): Promise<CacheSizeInfo> {
  return await invoke<CacheSizeInfo>('get_cache_size');
}

/** 清理所有缓存文件 */
export async function clearCache(): Promise<void> {
  return await invoke<void>('clear_cache');
}

/** 将字节数转换为人类可读格式 */
export function formatCacheSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, exponent);

  // B 和 KB 保留 1 位小数，MB 及以上保留 1 位
  const formatted = exponent <= 1
    ? value.toFixed(1)
    : value.toFixed(1);

  return `${formatted} ${units[exponent]}`;
}
