import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TextureLRUCache, getSizeForDisplay, estimateTextureBytes } from './useImageLoader';

// ─── Mock Texture ────────────────────────────────────

function createMockTexture(id: string, width: number = 100, height: number = 100) {
  return {
    _id: id,
    width,
    height,
    destroy: vi.fn(),
  } as any;
}

// ─── TextureLRUCache ─────────────────────────────────

describe('TextureLRUCache', () => {
  let cache: TextureLRUCache;

  beforeEach(() => {
    cache = new TextureLRUCache(3);
  });

  it('应存入和取出纹理', () => {
    const tex = createMockTexture('a');
    cache.set('a', tex);

    expect(cache.get('a')).toBe(tex);
    expect(cache.size).toBe(1);
  });

  it('未命中返回 undefined', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('has 检查存在性', () => {
    cache.set('a', createMockTexture('a'));
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
  });

  it('容量限制：超出容量时淘汰最久未使用', () => {
    const texA = createMockTexture('a');
    const texB = createMockTexture('b');
    const texC = createMockTexture('c');
    const texD = createMockTexture('d');

    cache.set('a', texA);
    cache.set('b', texB);
    cache.set('c', texC);
    expect(cache.size).toBe(3);

    // 加入第 4 个，淘汰 a（最早插入）
    cache.set('d', texD);
    expect(cache.size).toBe(3);
    expect(cache.has('a')).toBe(false);
    expect(texA.destroy).toHaveBeenCalledOnce();

    expect(cache.has('b')).toBe(true);
    expect(cache.has('c')).toBe(true);
    expect(cache.has('d')).toBe(true);
  });

  it('LRU 淘汰顺序：get 操作更新访问时间', () => {
    const texA = createMockTexture('a');
    const texB = createMockTexture('b');
    const texC = createMockTexture('c');
    const texD = createMockTexture('d');

    cache.set('a', texA);
    cache.set('b', texB);
    cache.set('c', texC);

    // 访问 a，使其成为最近使用
    cache.get('a');

    // 加入 d，应淘汰 b（最久未使用）
    cache.set('d', texD);
    expect(cache.has('b')).toBe(false);
    expect(texB.destroy).toHaveBeenCalledOnce();
    expect(cache.has('a')).toBe(true);
  });

  it('重复 set 同一 key：更新纹理并移到末尾', () => {
    const texA1 = createMockTexture('a1');
    const texA2 = createMockTexture('a2');
    const texB = createMockTexture('b');
    const texC = createMockTexture('c');
    const texD = createMockTexture('d');

    cache.set('a', texA1);
    cache.set('b', texB);
    cache.set('c', texC);

    // 重新设置 a（值更新，位置移到末尾）
    cache.set('a', texA2);
    expect(cache.size).toBe(3);
    expect(cache.get('a')).toBe(texA2);

    // 加入 d，应淘汰 b（a 已移到末尾）
    cache.set('d', texD);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('a')).toBe(true);
  });

  it('clear 销毁所有纹理', () => {
    const texA = createMockTexture('a');
    const texB = createMockTexture('b');
    cache.set('a', texA);
    cache.set('b', texB);

    cache.clear();

    expect(cache.size).toBe(0);
    expect(texA.destroy).toHaveBeenCalledOnce();
    expect(texB.destroy).toHaveBeenCalledOnce();
  });

  it('容量为 1 时正确工作', () => {
    const smallCache = new TextureLRUCache(1);
    const texA = createMockTexture('a');
    const texB = createMockTexture('b');

    smallCache.set('a', texA);
    smallCache.set('b', texB);

    expect(smallCache.size).toBe(1);
    expect(smallCache.has('a')).toBe(false);
    expect(smallCache.has('b')).toBe(true);
    expect(texA.destroy).toHaveBeenCalledOnce();
  });
});

// ─── getSizeForDisplay ───────────────────────────────

describe('getSizeForDisplay', () => {
  it('显示宽度 ≤ 200px 返回 thumbnail', () => {
    expect(getSizeForDisplay(50)).toBe('thumbnail');
    expect(getSizeForDisplay(100)).toBe('thumbnail');
    expect(getSizeForDisplay(200)).toBe('thumbnail');
  });

  it('显示宽度 > 200px 返回 medium', () => {
    expect(getSizeForDisplay(201)).toBe('medium');
    expect(getSizeForDisplay(500)).toBe('medium');
    expect(getSizeForDisplay(900)).toBe('medium');
  });
});

// ─── estimateTextureBytes ────────────────────────────

describe('estimateTextureBytes', () => {
  it('计算 RGBA 纹理内存（宽×高×4）', () => {
    const tex = createMockTexture('a', 1920, 1080);
    expect(estimateTextureBytes(tex)).toBe(1920 * 1080 * 4);
  });

  it('零尺寸纹理返回 0', () => {
    const tex = createMockTexture('a', 0, 0);
    expect(estimateTextureBytes(tex)).toBe(0);
  });
});

// ─── TextureLRUCache 内存上限 ────────────────────────

describe('TextureLRUCache 内存上限', () => {
  it('跟踪当前内存占用', () => {
    // 容量大（不触发数量淘汰），内存上限设大
    const cache = new TextureLRUCache(100, 100 * 1024 * 1024);

    const tex1 = createMockTexture('a', 100, 100); // 40000 bytes
    cache.set('a', tex1);
    expect(cache.currentMemory).toBe(100 * 100 * 4);

    const tex2 = createMockTexture('b', 200, 200); // 160000 bytes
    cache.set('b', tex2);
    expect(cache.currentMemory).toBe(100 * 100 * 4 + 200 * 200 * 4);
  });

  it('超出内存上限时淘汰最久未使用的纹理', () => {
    // 每个纹理 100x100 = 40000 bytes，内存上限设为 100000（可容纳 2 个，第 3 个触发淘汰）
    const memLimit = 100000;
    const cache = new TextureLRUCache(100, memLimit);

    const texA = createMockTexture('a', 100, 100);
    const texB = createMockTexture('b', 100, 100);
    const texC = createMockTexture('c', 100, 100);

    cache.set('a', texA);
    cache.set('b', texB);
    expect(cache.size).toBe(2);
    expect(cache.currentMemory).toBe(80000);

    // 第 3 个纹理会导致超出上限 → 淘汰 a
    cache.set('c', texC);
    expect(cache.has('a')).toBe(false);
    expect(texA.destroy).toHaveBeenCalledOnce();
    expect(cache.size).toBe(2);
    expect(cache.currentMemory).toBe(80000);
  });

  it('clear 后内存归零', () => {
    const cache = new TextureLRUCache(100, 100 * 1024 * 1024);
    cache.set('a', createMockTexture('a', 500, 500));
    cache.set('b', createMockTexture('b', 300, 300));

    cache.clear();
    expect(cache.currentMemory).toBe(0);
    expect(cache.size).toBe(0);
  });

  it('重复 set 同一 key 更新内存统计', () => {
    const cache = new TextureLRUCache(100, 100 * 1024 * 1024);

    const texSmall = createMockTexture('a', 100, 100); // 40000
    cache.set('a', texSmall);
    expect(cache.currentMemory).toBe(40000);

    const texLarge = createMockTexture('a2', 200, 200); // 160000
    cache.set('a', texLarge);
    expect(cache.currentMemory).toBe(160000);
    expect(cache.size).toBe(1);
  });
});
