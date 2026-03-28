// ============================================================
// 纹理 LRU 缓存 + 图片加载器
//
// - TextureLRUCache: 基于 Map 的 LRU 缓存，支持内存上限
// - ImageLoader: 异步加载逻辑，支持分级 (thumbnail/medium)
// ============================================================

import { Assets, Texture } from 'pixi.js';
import * as imageService from '../services/imageService';

// ─── 常量 ─────────────────────────────────────────────

/** 默认内存上限 300MB（GPU 纹理以 RGBA 4 字节/像素计） */
const DEFAULT_MEMORY_LIMIT = 300 * 1024 * 1024;

/** 估算单个纹理的 GPU 内存占用（RGBA 4 bytes/pixel） */
export function estimateTextureBytes(texture: Texture): number {
  const w = texture.width;
  const h = texture.height;
  return w > 0 && h > 0 ? w * h * 4 : 0;
}

// ─── TextureLRUCache ─────────────────────────────────

/**
 * LRU 纹理缓存（内存感知）
 *
 * 利用 Map 的插入顺序特性实现 LRU：
 * - get/set 操作会将条目移到末尾（最近使用）
 * - 淘汰从头部（最久未使用）开始
 * - 同时跟踪总内存估算，超出上限时触发淘汰
 * - 淘汰时调用 texture.destroy() 释放 GPU 内存
 */
export class TextureLRUCache {
  private cache = new Map<string, Texture>();
  private readonly capacity: number;
  private readonly memoryLimit: number;
  private _currentMemory: number = 0;

  constructor(capacity: number = 300, memoryLimit: number = DEFAULT_MEMORY_LIMIT) {
    this.capacity = capacity;
    this.memoryLimit = memoryLimit;
  }

  /** 获取纹理，命中时更新 LRU 顺序 */
  get(key: string): Texture | undefined {
    const texture = this.cache.get(key);
    if (!texture) return undefined;

    // 移到末尾（最近使用）
    this.cache.delete(key);
    this.cache.set(key, texture);
    return texture;
  }

  /** 存入纹理，超出容量或内存上限时淘汰最久未使用的 */
  set(key: string, texture: Texture): void {
    const texBytes = estimateTextureBytes(texture);

    // 如果已存在，先删除（重新插入到末尾）
    if (this.cache.has(key)) {
      const existing = this.cache.get(key)!;
      this._currentMemory -= estimateTextureBytes(existing);
      this.cache.delete(key);
    }

    // 容量和内存上限检查，淘汰最久未使用
    while (
      this.cache.size >= this.capacity ||
      (this.cache.size > 0 && this._currentMemory + texBytes > this.memoryLimit)
    ) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey === undefined) break;
      const evicted = this.cache.get(firstKey)!;
      this._currentMemory -= estimateTextureBytes(evicted);
      this.cache.delete(firstKey);
      evicted.destroy();
    }

    this.cache.set(key, texture);
    this._currentMemory += texBytes;
  }

  /** 检查是否存在 */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /** 当前缓存大小 */
  get size(): number {
    return this.cache.size;
  }

  /** 当前估算内存占用（字节） */
  get currentMemory(): number {
    return this._currentMemory;
  }

  /** 清空缓存，销毁所有纹理 */
  clear(): void {
    for (const texture of this.cache.values()) {
      texture.destroy();
    }
    this.cache.clear();
    this._currentMemory = 0;
  }
}

// ─── ImageLoader ─────────────────────────────────────

/** 缓存键：hash + size */
function cacheKey(hash: string, size: string): string {
  return `${hash}:${size}`;
}

/** 根据缩放级别决定加载的图片尺寸 */
export function getSizeForZoom(zoomLevel: number): string {
  return zoomLevel < 0.5 ? 'thumbnail' : 'medium';
}

/**
 * 图片加载器
 *
 * 封装异步纹理加载逻辑：
 * 1. 通过 imageService.getImageUrl 获取 asset:// URL
 * 2. 通过 PixiJS Assets.load 加载为 Texture
 * 3. 缓存到 TextureLRUCache
 */
export class ImageLoader {
  private textureCache: TextureLRUCache;
  /** 正在加载中的请求，避免重复加载 */
  private pending = new Map<string, Promise<Texture | null>>();

  constructor(cacheCapacity: number = 300) {
    this.textureCache = new TextureLRUCache(cacheCapacity);
  }

  /**
   * 加载图片纹理
   *
   * @returns Texture 或 null（加载失败）
   */
  async loadTexture(
    hash: string,
    zoomLevel: number,
  ): Promise<Texture | null> {
    const size = getSizeForZoom(zoomLevel);
    const key = cacheKey(hash, size);

    // 缓存命中
    const cached = this.textureCache.get(key);
    if (cached) return cached;

    // 已有进行中的加载
    const pendingPromise = this.pending.get(key);
    if (pendingPromise) return pendingPromise;

    // 发起新的加载
    const loadPromise = this.doLoad(hash, size, key);
    this.pending.set(key, loadPromise);

    try {
      return await loadPromise;
    } finally {
      this.pending.delete(key);
    }
  }

  /**
   * 缩放阈值切换时，重新加载视口内图片
   *
   * @param visibleHashes 当前视口内的 hash 列表
   * @param newZoomLevel 新的缩放级别
   * @param onTextureReady 纹理加载完成的回调
   */
  async reloadForZoomChange(
    visibleHashes: string[],
    newZoomLevel: number,
    onTextureReady: (hash: string, texture: Texture) => void,
  ): Promise<void> {
    const size = getSizeForZoom(newZoomLevel);

    const promises = visibleHashes.map(async (hash) => {
      const key = cacheKey(hash, size);
      // 跳过已有正确尺寸的纹理
      if (this.textureCache.has(key)) {
        const tex = this.textureCache.get(key)!;
        onTextureReady(hash, tex);
        return;
      }

      const texture = await this.loadTexture(hash, newZoomLevel);
      if (texture) {
        onTextureReady(hash, texture);
      }
    });

    await Promise.allSettled(promises);
  }

  /** 获取内部缓存实例（用于测试） */
  getCache(): TextureLRUCache {
    return this.textureCache;
  }

  /** 清理所有资源 */
  destroy(): void {
    this.pending.clear();
    this.textureCache.clear();
  }

  // ── 内部 ──

  private async doLoad(
    hash: string,
    size: string,
    key: string,
  ): Promise<Texture | null> {
    try {
      const url = await imageService.getImageUrl(hash, size);
      const texture = await Assets.load<Texture>(url);
      this.textureCache.set(key, texture);
      return texture;
    } catch (err) {
      console.warn(`纹理加载失败 [${hash}/${size}]:`, err);
      return null;
    }
  }
}
