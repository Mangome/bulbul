import { invoke } from '@tauri-apps/api/core';
import type { ExportResult } from '../types';

/** 选择导出目录 */
export async function selectExportDir(): Promise<string | null> {
  return await invoke<string | null>('select_export_dir');
}

/** 导出图片 */
export async function exportImages(
  hashes: string[],
  targetDir: string
): Promise<ExportResult> {
  return await invoke<ExportResult>('export_images', { hashes, targetDir });
}
