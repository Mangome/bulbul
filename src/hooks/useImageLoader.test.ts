import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TextureLRUCache, getSizeForZoom } from './useImageLoader';

// ─── Mock Texture ────────────────────────────────────

function createMockTexture(id: string) {
  return {
    _id: id,
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

// ─── getSizeForZoom ──────────────────────────────────

describe('getSizeForZoom', () => {
  it('缩放 < 50% 返回 thumbnail', () => {
    expect(getSizeForZoom(0.1)).toBe('thumbnail');
    expect(getSizeForZoom(0.3)).toBe('thumbnail');
    expect(getSizeForZoom(0.49)).toBe('thumbnail');
  });

  it('缩放 ≥ 50% 返回 medium', () => {
    expect(getSizeForZoom(0.5)).toBe('medium');
    expect(getSizeForZoom(1.0)).toBe('medium');
    expect(getSizeForZoom(3.0)).toBe('medium');
  });
});
