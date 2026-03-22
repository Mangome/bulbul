import { describe, it, expect } from 'vitest';
import {
  buildSortedIndex,
  getVisibleItems,
  diffVisibleItems,
  type ViewportRect,
} from './viewport';
import type { LayoutItem } from './layout';

// ─── 测试工具 ─────────────────────────────────────────

function makeItem(
  hash: string,
  x: number,
  y: number,
  width: number,
  height: number,
  groupId: number = 1,
): LayoutItem {
  return { hash, groupId, x, y, width, height };
}

// ─── 构建索引 ─────────────────────────────────────────

describe('buildSortedIndex', () => {
  it('按 Y 坐标升序排列', () => {
    const items = [
      makeItem('c', 0, 300, 100, 100),
      makeItem('a', 0, 100, 100, 100),
      makeItem('b', 0, 200, 100, 100),
    ];
    const index = buildSortedIndex(items);

    expect(index.items[0].hash).toBe('a');
    expect(index.items[1].hash).toBe('b');
    expect(index.items[2].hash).toBe('c');
  });

  it('不修改原数组', () => {
    const items = [
      makeItem('b', 0, 200, 100, 100),
      makeItem('a', 0, 100, 100, 100),
    ];
    buildSortedIndex(items);
    expect(items[0].hash).toBe('b'); // 原数组不变
  });
});

// ─── getVisibleItems ─────────────────────────────────

describe('getVisibleItems', () => {
  // 创建一列垂直排列的元素：y = 0, 200, 400, 600, 800, 1000
  const items = [
    makeItem('a', 0, 0, 100, 100),
    makeItem('b', 0, 200, 100, 100),
    makeItem('c', 0, 400, 100, 100),
    makeItem('d', 0, 600, 100, 100),
    makeItem('e', 0, 800, 100, 100),
    makeItem('f', 0, 1000, 100, 100),
  ];
  const index = buildSortedIndex(items);

  it('视口内元素正确返回', () => {
    const viewport: ViewportRect = { x: 0, y: 300, width: 500, height: 400 };
    // 视口 y=300~700, 缓冲区 50% → 200px, 有效范围 y=100~900
    // 可见: b(200-300), c(400-500), d(600-700), e(800-900)
    const visible = getVisibleItems(index, viewport);

    const hashes = visible.map((v) => v.hash);
    expect(hashes).toContain('b');
    expect(hashes).toContain('c');
    expect(hashes).toContain('d');
    expect(hashes).toContain('e');
  });

  it('视口外元素不返回', () => {
    const viewport: ViewportRect = { x: 0, y: 300, width: 500, height: 400 };
    const visible = getVisibleItems(index, viewport);
    const hashes = visible.map((v) => v.hash);
    // f 在 1000-1100, 缓冲区有效范围到 900，不包含 f
    expect(hashes).not.toContain('f');
  });

  it('缓冲区边界判定：刚好在缓冲区内', () => {
    // 视口 y=500, height=200, 缓冲区 100px → 范围 400~800
    const viewport: ViewportRect = { x: 0, y: 500, width: 500, height: 200 };
    const visible = getVisibleItems(index, viewport);
    const hashes = visible.map((v) => v.hash);

    // c 在 400-500, 正好在缓冲区边界
    expect(hashes).toContain('c');
    // e 在 800-900, 顶边正好在边界
    expect(hashes).toContain('e');
  });

  it('无缓冲区模式', () => {
    const viewport: ViewportRect = { x: 0, y: 350, width: 500, height: 200 };
    // 无缓冲区范围：350~550
    const visible = getVisibleItems(index, viewport, 0);
    const hashes = visible.map((v) => v.hash);

    // b(200-300) 底边 300 < 350 → 不可见
    expect(hashes).not.toContain('b');
    // c(400-500) 在范围内
    expect(hashes).toContain('c');
    // d(600-700) 顶边 600 > 550 → 不可见
    expect(hashes).not.toContain('d');
  });

  it('极端缩放：视口覆盖所有元素', () => {
    const viewport: ViewportRect = { x: -1000, y: -1000, width: 5000, height: 5000 };
    const visible = getVisibleItems(index, viewport);
    expect(visible).toHaveLength(6);
  });

  it('空列表返回空', () => {
    const emptyIndex = buildSortedIndex([]);
    const viewport: ViewportRect = { x: 0, y: 0, width: 500, height: 500 };
    const visible = getVisibleItems(emptyIndex, viewport);
    expect(visible).toHaveLength(0);
  });

  it('X 轴范围外的元素不返回', () => {
    const wideItems = [
      makeItem('left', -500, 100, 100, 100),   // x: -500 ~ -400
      makeItem('center', 100, 100, 100, 100),   // x: 100 ~ 200
      makeItem('right', 1000, 100, 100, 100),  // x: 1000 ~ 1100
    ];
    const wideIndex = buildSortedIndex(wideItems);
    const viewport: ViewportRect = { x: 0, y: 0, width: 500, height: 500 };

    const visible = getVisibleItems(wideIndex, viewport);
    const hashes = visible.map((v) => v.hash);
    expect(hashes).toContain('center');
    expect(hashes).not.toContain('left');
    expect(hashes).not.toContain('right');
  });
});

// ─── diffVisibleItems ────────────────────────────────

describe('diffVisibleItems', () => {
  it('全部新进入', () => {
    const prev: LayoutItem[] = [];
    const curr = [
      makeItem('a', 0, 0, 100, 100),
      makeItem('b', 0, 100, 100, 100),
    ];

    const diff = diffVisibleItems(prev, curr);
    expect(diff.enter).toHaveLength(2);
    expect(diff.leave).toHaveLength(0);
  });

  it('全部离开', () => {
    const prev = [
      makeItem('a', 0, 0, 100, 100),
      makeItem('b', 0, 100, 100, 100),
    ];
    const curr: LayoutItem[] = [];

    const diff = diffVisibleItems(prev, curr);
    expect(diff.enter).toHaveLength(0);
    expect(diff.leave).toHaveLength(2);
  });

  it('部分进入、部分离开', () => {
    const prev = [
      makeItem('a', 0, 0, 100, 100),
      makeItem('b', 0, 100, 100, 100),
    ];
    const curr = [
      makeItem('b', 0, 100, 100, 100),
      makeItem('c', 0, 200, 100, 100),
    ];

    const diff = diffVisibleItems(prev, curr);
    expect(diff.enter.map((i) => i.hash)).toEqual(['c']);
    expect(diff.leave.map((i) => i.hash)).toEqual(['a']);
  });

  it('无变化返回空 diff', () => {
    const items = [
      makeItem('a', 0, 0, 100, 100),
      makeItem('b', 0, 100, 100, 100),
    ];

    const diff = diffVisibleItems(items, items);
    expect(diff.enter).toHaveLength(0);
    expect(diff.leave).toHaveLength(0);
  });

  it('滚动增量更新', () => {
    // 模拟向下滚动：a 离开，d 进入
    const prev = [
      makeItem('a', 0, 0, 100, 100),
      makeItem('b', 0, 200, 100, 100),
      makeItem('c', 0, 400, 100, 100),
    ];
    const curr = [
      makeItem('b', 0, 200, 100, 100),
      makeItem('c', 0, 400, 100, 100),
      makeItem('d', 0, 600, 100, 100),
    ];

    const diff = diffVisibleItems(prev, curr);
    expect(diff.enter.map((i) => i.hash)).toEqual(['d']);
    expect(diff.leave.map((i) => i.hash)).toEqual(['a']);
  });
});
