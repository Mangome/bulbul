import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { ProcessingProgress, GroupResult } from '../types';

/** 开始处理文件夹 */
export async function processFolder(
  folderPath: string,
  options?: {
    similarityThreshold?: number;
    timeGapSeconds?: number;
  }
): Promise<GroupResult> {
  return await invoke<GroupResult>('process_folder', {
    folderPath,
    similarityThreshold: options?.similarityThreshold ?? 90.0,
    timeGapSeconds: options?.timeGapSeconds ?? 10,
  });
}

/** 取消处理 */
export async function cancelProcessing(): Promise<void> {
  return await invoke('cancel_processing');
}

/** 使用新阈值重新分组（不重新扫描） */
export async function regroup(
  similarityThreshold: number,
  timeGapSeconds: number,
): Promise<GroupResult> {
  return await invoke<GroupResult>('regroup', {
    similarityThreshold,
    timeGapSeconds,
  });
}

/** 使用指定 GPS 坐标重新分类（复用检测结果，仅重跑分类） */
export async function reclassify(lat: number, lng: number): Promise<void> {
  return await invoke('reclassify', { lat, lng });
}

/** 监听处理进度事件 */
export async function onProgress(
  callback: (progress: ProcessingProgress) => void
): Promise<UnlistenFn> {
  return await listen<ProcessingProgress>('processing-progress', (event) => {
    callback(event.payload);
  });
}

/** 监听处理完成事件 */
export async function onCompleted(
  callback: (result: GroupResult) => void
): Promise<UnlistenFn> {
  return await listen<GroupResult>('processing-completed', (event) => {
    callback(event.payload);
  });
}

/** 监听处理失败事件 */
export async function onFailed(
  callback: (error: string) => void
): Promise<UnlistenFn> {
  return await listen<string>('processing-failed', (event) => {
    callback(event.payload);
  });
}
