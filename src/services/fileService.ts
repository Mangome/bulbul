import { invoke } from '@tauri-apps/api/core';
import type { FolderInfo, ScanResult } from '../types';

/** 弹出系统文件夹选择对话框 */
export async function selectFolder(): Promise<string | null> {
  return await invoke<string | null>('select_folder');
}

/** 获取文件夹信息 */
export async function getFolderInfo(path: string): Promise<FolderInfo> {
  return await invoke<FolderInfo>('get_folder_info', { path });
}

/** 扫描文件夹中的 RAW 文件 */
export async function scanRawFiles(path: string): Promise<ScanResult> {
  return await invoke<ScanResult>('scan_raw_files', { path });
}
