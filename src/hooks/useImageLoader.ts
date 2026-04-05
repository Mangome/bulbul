// ============================================================
// ImageBitmap LRU 缓存系统
//
// 设计原则：
// 1. 加载：fetch + createImageBitmap，不依赖任何渲染框架
// 2. 释放：淘汰时调用 image.close() 释放内存
// 3. LRU 缓存控制同时在内存中的 ImageBitmap 数量，超出限制时立即释放
// ============================================================

import * as imageService from '../services/imageService';

// ─── 常量 ─────────────────────────────────────────────

/** 默认内存上限 200MB（RGBA 4 字节/像素计） */
const DEFAULT_MEMORY_LIMIT = 200 * 1024 * 1024;

/** 缩略图的原始像素宽度（与后端 THUMBNAIL_WIDTH 保持一致） */
const THUMBNAIL_PIXEL_WIDTH = 200;

/** 估算单个 ImageBitmap 的内存占用（RGBA 4 bytes/pixel） */
export function estimateImageBytes(image: ImageBitmap): number {
  const w = image.width;
  const h = image.height;
  return w > 0 && h > 0 ? w * h * 4 : 0;
}

// ─── 缓存条目 ────────────────────────────────────────

interface CacheEntry {
  image: ImageBitmap;
  /** 内存占用（字节） */
  bytes: number;
  /** 版本号，用于检测销毁后的重新加载 */
  version: number;
}

// ─── ImageLRUCache ───────────────────────────────────

/**
 * LRU 图片缓存（内存感知）
 *
 * 利用 Map 的插入顺序特性实现 LRU：
 * - get/set 操作会将条目移到末尾（最近使用）
 * - 淘汰从头部（最久未使用）开始
 * - 同时跟踪总内存估算，超出上限时触发淘汰
 *
 * 释放策略：
 * - 淘汰时调用 image.close() 释放内存
 */
export class ImageLRUCache {
  private cache = new Map<string, CacheEntry>();
  private readonly capacity: number;
  private readonly memoryLimit: number;
  private _currentMemory: number = 0;
  private versionMap = new Map<string, number>();

  constructor(cacheCapacity: number = 30, memoryLimit: number = DEFAULT_MEMORY_LIMIT) {
    this.capacity = cacheCapacity;
    this.memoryLimit = memoryLimit;
  }

  /** 获取图片，命中时更新 LRU 顺序 */
  get(key: string): ImageBitmap | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.image;
  }

  /** 存入图片，超出容量或内存上限时淘汰最久未使用的 */
  set(key: string, image: ImageBitmap): void {
    const imgBytes = estimateImageBytes(image);

    if (this.cache.has(key)) {
      const existing = this.cache.get(key)!;
      this._currentMemory -= existing.bytes;
      existing.image.close();
      this.cache.delete(key);
    }

    while (
      this.cache.size >= this.capacity ||
      (this.cache.size > 0 && this._currentMemory + imgBytes > this.memoryLimit)
    ) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey === undefined) break;
      this._evictEntry(firstKey);
    }

    const currentVersion = (this.versionMap.get(key) ?? 0) + 1;
    this.versionMap.set(key, currentVersion);

    this.cache.set(key, { image, bytes: imgBytes, version: currentVersion });
    this._currentMemory += imgBytes;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  get size(): number {
    return this.cache.size;
  }

  get currentMemory(): number {
    return this._currentMemory;
  }

  /** 清空缓存，释放所有图片 */
  clear(): void {
    for (const [, entry] of this.cache) {
      entry.image.close();
    }
    this.cache.clear();
    this._currentMemory = 0;
  }

  isImageValid(key: string, version: number): boolean {
    const currentVersion = this.versionMap.get(key) ?? 0;
    return version === currentVersion && this.cache.has(key);
  }

  getVersion(key: string): number {
    return this.versionMap.get(key) ?? 0;
  }

  /** 主动释放指定的图片 */
  evict(key: string): void {
    if (this.cache.has(key)) {
      this._evictEntry(key);
    }
  }

  private _evictEntry(key: string): void {
    const entry = this.cache.get(key);
    if (!entry) return;

    this._currentMemory -= entry.bytes;
    this.cache.delete(key);
    entry.image.close();
  }
}

// ─── 直接加载 ImageBitmap ────────────────────────────

/**
 * 通过 fetch + createImageBitmap 加载图片
 */
async function loadImageFromUrl(url: string): Promise<ImageBitmap> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const blob = await response.blob();
  return createImageBitmap(blob);
}

// ─── ImageLoader ─────────────────────────────────────

function cacheKey(hash: string, size: string): string {
  return `${hash}:${size}`;
}

export function getSizeForDisplay(displayWidth: number): string {
  return displayWidth > THUMBNAIL_PIXEL_WIDTH ? 'medium' : 'thumbnail';
}

export interface ImageWithVersion {
  image: ImageBitmap;
  key: string;
  version: number;
}

export class ImageLoader {
  private imageCache: ImageLRUCache;
  private pending = new Map<string, Promise<ImageWithVersion | null>>();

  constructor(cacheCapacity: number = 30) {
    this.imageCache = new ImageLRUCache(cacheCapacity);
  }

  async loadImage(
    hash: string,
    displayWidth: number,
  ): Promise<ImageWithVersion | null> {
    const size = getSizeForDisplay(displayWidth);
    const key = cacheKey(hash, size);

    const cached = this.imageCache.get(key);
    if (cached) {
      const version = this.imageCache.getVersion(key);
      return { image: cached, key, version };
    }

    const pendingPromise = this.pending.get(key);
    if (pendingPromise) return pendingPromise;

    const loadPromise = this.doLoad(hash, size, key);
    this.pending.set(key, loadPromise);

    try {
      return await loadPromise;
    } finally {
      this.pending.delete(key);
    }
  }

  async reloadForZoomChange(
    entries: Array<{ hash: string; displayWidth: number }>,
    onImageReady: (hash: string, result: ImageWithVersion) => void,
  ): Promise<void> {
    const promises = entries.map(async ({ hash, displayWidth }) => {
      const size = getSizeForDisplay(displayWidth);
      const key = cacheKey(hash, size);
      if (this.imageCache.has(key)) {
        const img = this.imageCache.get(key);
        if (img) {
          const version = this.imageCache.getVersion(key);
          onImageReady(hash, { image: img, key, version });
        }
        return;
      }
      const result = await this.loadImage(hash, displayWidth);
      if (result) {
        onImageReady(hash, result);
      }
    });
    await Promise.allSettled(promises);
  }

  getCache(): ImageLRUCache {
    return this.imageCache;
  }

  evictImage(hash: string): void {
    this.imageCache.evict(cacheKey(hash, 'medium'));
    this.imageCache.evict(cacheKey(hash, 'thumbnail'));
  }

  destroy(): void {
    this.pending.clear();
    this.imageCache.clear();
  }

  private async doLoad(
    hash: string,
    size: string,
    key: string,
  ): Promise<ImageWithVersion | null> {
    try {
      const url = await imageService.getImageUrl(hash, size);
      const image = await loadImageFromUrl(url);
      this.imageCache.set(key, image);
      const version = this.imageCache.getVersion(key);
      return { image, key, version };
    } catch (err) {
      console.warn(`图片加载失败 [${hash}/${size}]:`, err);
      return null;
    }
  }
}
