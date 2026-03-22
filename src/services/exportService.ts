// ============================================================
// 导出服务 (exportService)
//
// 封装 Tauri 导出命令和事件监听。
// ============================================================

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { ExportResult } from '../types';

// ─── 类型 ─────────────────────────────────────────────

export interface ExportProgress {
  current: number;
  total: number;
}

// ─── 命令封装 ─────────────────────────────────────────

/** 选择导出目录 */
export async function selectExportDir(): Promise<string | null> {
  return await invoke<string | null>('select_export_dir');
}

/** 导出图片 */
export async function exportImages(
  hashes: string[],
  targetDir: string,
): Promise<ExportResult> {
  return await invoke<ExportResult>('export_images', { hashes, targetDir });
}

// ─── 事件监听 ─────────────────────────────────────────

/** 监听导出进度事件 */
export function onExportProgress(
  callback: (progress: ExportProgress) => void,
): Promise<UnlistenFn> {
  return listen<ExportProgress>('export-progress', (event) => {
    callback(event.payload);
  });
}

// ─── 导出流程编排 ─────────────────────────────────────

export interface ExportFlowResult {
  success: boolean;
  cancelled: boolean;
  result?: ExportResult;
  error?: string;
}

/**
 * 完整导出流程：
 * 1. 打开目录选择对话框
 * 2. 调用 Rust 导出
 * 3. 返回结果
 */
export async function runExportFlow(
  hashes: string[],
  onProgress?: (progress: ExportProgress) => void,
): Promise<ExportFlowResult> {
  if (hashes.length === 0) {
    return { success: false, cancelled: false, error: '没有选中图片' };
  }

  // 选择目标目录
  const targetDir = await selectExportDir();
  if (!targetDir) {
    return { success: false, cancelled: true };
  }

  // 监听进度
  let unlisten: UnlistenFn | null = null;
  if (onProgress) {
    unlisten = await onExportProgress(onProgress);
  }

  try {
    const result = await exportImages(hashes, targetDir);
    return { success: true, cancelled: false, result };
  } catch (e) {
    return {
      success: false,
      cancelled: false,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    unlisten?.();
  }
}
