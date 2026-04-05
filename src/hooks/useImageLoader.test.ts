import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImageLRUCache, getSizeForDisplay, estimateImageBytes } from './useImageLoader';

// ─── Mock ImageBitmap ────────────────────────────────

function createMockImage(id: string, width: number = 100, height: number = 100): ImageBitmap {
  return {
    _id: id,
    width,
    height,
    close: vi.fn(),
  } as any;
}

// ─── ImageLRUCache ───────────────────────────────────

describe('ImageLRUCache', () => {
  let cache: ImageLRUCache;

  beforeEach(() => {
    cache = new ImageLRUCache(3);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('应存入和取出图片', () => {
    const img = createMockImage('a');
    cache.set('a', img);
    expect(cache.get('a')).toBe(img);
    expect(cache.size).toBe(1);
  });

  it('未命中返回 undefined', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('has 检查存在性', () => {
    cache.set('a', createMockImage('a'));
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
  });

  it('容量限制：超出容量时淘汰最久未使用', () => {
    cache.set('a', createMockImage('a'));
    cache.set('b', createMockImage('b'));
    cache.set('c', createMockImage('c'));
    cache.set('d', createMockImage('d'));
    expect(cache.size).toBe(3);
    expect(cache.has('a')).toBe(false);
  });

  it('LRU 淘汰顺序：get 操作更新访问时间', () => {
    cache.set('a', createMockImage('a'));
    cache.set('b', createMockImage('b'));
    cache.set('c', createMockImage('c'));
    cache.get('a');
    cache.set('d', createMockImage('d'));
    expect(cache.has('b')).toBe(false);
    expect(cache.has('a')).toBe(true);
  });

  it('重复 set 同一 key：替换图片', () => {
    cache.set('a', createMockImage('a1'));
    const imgA2 = createMockImage('a2');
    cache.set('a', imgA2);
    expect(cache.get('a')).toBe(imgA2);
    expect(cache.size).toBe(1);
  });

  it('clear 清空缓存并释放图片', () => {
    const imgA = createMockImage('a');
    const imgB = createMockImage('b');
    cache.set('a', imgA);
    cache.set('b', imgB);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('容量为 1 时正确工作', () => {
    const small = new ImageLRUCache(1);
    small.set('a', createMockImage('a'));
    small.set('b', createMockImage('b'));
    expect(small.has('a')).toBe(false);
    expect(small.has('b')).toBe(true);
  });
});

// ─── getSizeForDisplay ───────────────────────────────

describe('getSizeForDisplay', () => {
  it('显示宽度 ≤ 200px 返回 thumbnail', () => {
    expect(getSizeForDisplay(50)).toBe('thumbnail');
    expect(getSizeForDisplay(200)).toBe('thumbnail');
  });

  it('显示宽度 > 200px 返回 medium', () => {
    expect(getSizeForDisplay(201)).toBe('medium');
    expect(getSizeForDisplay(900)).toBe('medium');
  });
});

// ─── estimateImageBytes ──────────────────────────────

describe('estimateImageBytes', () => {
  it('计算 RGBA 内存（宽×高×4）', () => {
    expect(estimateImageBytes(createMockImage('a', 1920, 1080))).toBe(1920 * 1080 * 4);
  });

  it('零尺寸图片返回 0', () => {
    expect(estimateImageBytes(createMockImage('a', 0, 0))).toBe(0);
  });
});

// ─── ImageLRUCache 内存上限 ──────────────────────────

describe('ImageLRUCache 内存上限', () => {
  it('跟踪当前内存占用', () => {
    const cache = new ImageLRUCache(100, 100 * 1024 * 1024);
    cache.set('a', createMockImage('a', 100, 100));
    expect(cache.currentMemory).toBe(40000);
    cache.set('b', createMockImage('b', 200, 200));
    expect(cache.currentMemory).toBe(40000 + 160000);
  });

  it('超出内存上限时淘汰', () => {
    const cache = new ImageLRUCache(100, 100000);
    cache.set('a', createMockImage('a', 100, 100));
    cache.set('b', createMockImage('b', 100, 100));
    cache.set('c', createMockImage('c', 100, 100));
    expect(cache.has('a')).toBe(false);
    expect(cache.size).toBe(2);
  });

  it('clear 后内存归零', () => {
    const cache = new ImageLRUCache(100, 100 * 1024 * 1024);
    cache.set('a', createMockImage('a', 500, 500));
    cache.clear();
    expect(cache.currentMemory).toBe(0);
  });

  it('版本号递增', () => {
    const cache = new ImageLRUCache(100);
    cache.set('a', createMockImage('a'));
    expect(cache.getVersion('a')).toBe(1);
    cache.set('a', createMockImage('b'));
    expect(cache.getVersion('a')).toBe(2);
  });

  it('isImageValid 检测淘汰', () => {
    const cache = new ImageLRUCache(100);
    cache.set('a', createMockImage('a'));
    const v = cache.getVersion('a');
    expect(cache.isImageValid('a', v)).toBe(true);
    cache.evict('a');
    expect(cache.isImageValid('a', v)).toBe(false);
  });

  it('evict 从缓存移除', () => {
    const cache = new ImageLRUCache(100);
    const img = createMockImage('a');
    cache.set('a', img);
    cache.evict('a');
    expect(cache.has('a')).toBe(false);
  });
});
