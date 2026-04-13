import { describe, it, expect } from 'vitest';
import {
  getVisibleItems,
  diffVisibleItems,
  type ViewportRect,
} from './viewport';
import type { LayoutItem, GroupPageLayout } from './layout';

// ─── 测试工具 ─────────────────────────────────────────

function makeItem(
  hash: string,
  x: number,
  y: number,
  width: number,
  height: number,
  groupId: number = 1,
  groupIndex: number = 0,
): LayoutItem {
  return { hash, groupId, groupIndex, x, y, width, height, isFirstInGroup: false, groupLabel: '' };
}

function makePage(
  groupIndex: number,
  items: LayoutItem[],
  offsetY: number = 0,
): GroupPageLayout {
  const sortedItems = [...items].sort((a, b) => a.y - b.y);
  const maxY = items.length > 0 ? Math.max(...items.map(i => i.y + i.height)) : 0;
  return {
    groupIndex,
    groupId: groupIndex + 1,
    offsetY,
    contentHeight: maxY - offsetY,
    columnWidth: 160,
    items,
    groupTitle: undefined,
    sortedItems,
  };
}

// ─── getVisibleItems (纵向模式) ──────────────────────────

describe('getVisibleItems', () => {
  const items = [
    makeItem('a', 0, 0, 100, 100),
    makeItem('b', 0, 200, 100, 100),
    makeItem('c', 0, 400, 100, 100),
    makeItem('d', 0, 600, 100, 100),
    makeItem('e', 0, 800, 100, 100),
    makeItem('f', 0, 1000, 100, 100),
  ];

  it('视口内元素正确返回', () => {
    const page = makePage(0, items, 0);
    const viewport: ViewportRect = { x: 0, y: 300, width: 1000, height: 400 };
    const visible = getVisibleItems([page], 0, viewport);
    const hashes = visible.map((v) => v.hash);
    // 缓冲区 1.0 * 400 = 400, 有效范围 y=-100 ~ 1100
    // 所有元素都应可见
    expect(hashes).toContain('a');
    expect(hashes).toContain('c');
    expect(hashes).toContain('d');
  });

  it('视口外元素不返回', () => {
    const page = makePage(0, items, 0);
    // 无缓冲区模式
    const viewport: ViewportRect = { x: 0, y: 500, width: 1000, height: 200 };
    const visible = getVisibleItems([page], 0, viewport, 0);
    const hashes = visible.map((v) => v.hash);
    expect(hashes).toContain('c');
    expect(hashes).toContain('d');
    expect(hashes).not.toContain('a');
    expect(hashes).not.toContain('f');
  });

  it('空 pages 返回空', () => {
    const viewport: ViewportRect = { x: 0, y: 0, width: 500, height: 500 };
    const visible = getVisibleItems([], 0, viewport);
    expect(visible).toHaveLength(0);
  });

  it('多分组纵向排列：只返回视口范围内的分组元素', () => {
    // 分组 0：y=0~500
    const page0Items = [
      makeItem('a0', 0, 0, 100, 100, 1, 0),
      makeItem('a1', 0, 200, 100, 100, 1, 0),
    ];
    // 分组 1：y=600~1100
    const page1Items = [
      makeItem('b0', 0, 600, 100, 100, 2, 1),
      makeItem('b1', 0, 800, 100, 100, 2, 1),
    ];
    // 分组 2：y=1200~1700
    const page2Items = [
      makeItem('c0', 0, 1200, 100, 100, 3, 2),
    ];

    const pages = [
      makePage(0, page0Items, 0),
      makePage(1, page1Items, 600),
      makePage(2, page2Items, 1200),
    ];

    // 视口在 y=700~900，只应看到分组 1 的元素
    const viewport: ViewportRect = { x: 0, y: 700, width: 1000, height: 200 };
    const visible = getVisibleItems(pages, 0, viewport, 0);
    const hashes = visible.map(v => v.hash);
    expect(hashes).toContain('b0');
    expect(hashes).toContain('b1');
    expect(hashes).not.toContain('a0');
    expect(hashes).not.toContain('c0');
  });

  it('视口跨多组时返回所有可见元素', () => {
    const page0Items = [
      makeItem('a0', 0, 0, 100, 100, 1, 0),
    ];
    const page1Items = [
      makeItem('b0', 0, 500, 100, 100, 2, 1),
    ];

    const pages = [
      makePage(0, page0Items, 0),
      makePage(1, page1Items, 500),
    ];

    const viewport: ViewportRect = { x: 0, y: 0, width: 1000, height: 700 };
    const visible = getVisibleItems(pages, 0, viewport, 0);
    const hashes = visible.map(v => v.hash);
    expect(hashes).toContain('a0');
    expect(hashes).toContain('b0');
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
