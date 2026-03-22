import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { ImageMetadata } from '../types';

/** 获取图片 URL（通过 hash 获取文件路径后转为 asset:// URL） */
export async function getImageUrl(
  hash: string,
  size?: string
): Promise<string> {
  const filePath = await invoke<string>('get_image_url', { hash, size: size ?? 'thumbnail' });
  return convertFileSrc(filePath);
}

/** 获取单张图片元数据 */
export async function getMetadata(hash: string): Promise<ImageMetadata> {
  return await invoke<ImageMetadata>('get_metadata', { hash });
}

/** 批量获取元数据（Rust 返回 HashMap<String, ImageMetadata>） */
export async function getBatchMetadata(
  hashes: string[]
): Promise<Record<string, ImageMetadata>> {
  return await invoke<Record<string, ImageMetadata>>('get_batch_metadata', { hashes });
}
