import { describe, it, expect } from 'vitest';
import {
  getVisibleItems,
  getVisibleItemsInPage,
  diffVisibleItems,
  type ViewportRect,
} from './viewport';
import type { LayoutItem, GroupPageLayout, GroupTitleItem } from './layout';

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
  return { hash, groupId, groupIndex, x, y, width, height };
}

function makePage(
  groupIndex: number,
  items: LayoutItem[],
  pageWidth: number = 1000,
): GroupPageLayout {
  const sortedItems = [...items].sort((a, b) => a.y - b.y);
  const maxY = items.length > 0 ? Math.max(...items.map(i => i.y + i.height)) : 0;
  const titleItem: GroupTitleItem = {
    groupId: groupIndex + 1,
    label: `Group ${groupIndex + 1}`,
    x: groupIndex * pageWidth,
    y: 0,
    width: pageWidth,
    height: 48,
  };
  return {
    groupIndex,
    groupId: groupIndex + 1,
    offsetX: groupIndex * pageWidth,
    contentHeight: maxY,
    columnWidth: 400,
    items,
    groupTitle: titleItem,
    sortedItems,
  };
}

// ─── getVisibleItemsInPage ─────────────────────────────

describe('getVisibleItemsInPage', () => {
  const items = [
    makeItem('a', 0, 0, 100, 100),
    makeItem('b', 0, 200, 100, 100),
    makeItem('c', 0, 400, 100, 100),
    makeItem('d', 0, 600, 100, 100),
    makeItem('e', 0, 800, 100, 100),
    makeItem('f', 0, 1000, 100, 100),
  ];
  const page = makePage(0, items);

  it('视口内元素正确返回', () => {
    // 视口 y=300~700, 缓冲区 50% → 200px, 有效范围 y=100~900
    const visible = getVisibleItemsInPage(page, 300, 400);
    const hashes = visible.map((v) => v.hash);
    expect(hashes).toContain('b');
    expect(hashes).toContain('c');
    expect(hashes).toContain('d');
    expect(hashes).toContain('e');
  });

  it('视口外元素不返回', () => {
    const visible = getVisibleItemsInPage(page, 300, 400);
    const hashes = visible.map((v) => v.hash);
    expect(hashes).not.toContain('f');
  });

  it('缓冲区边界判定', () => {
    const visible = getVisibleItemsInPage(page, 500, 200);
    const hashes = visible.map((v) => v.hash);
    expect(hashes).toContain('c');
    expect(hashes).toContain('e');
  });

  it('无缓冲区模式', () => {
    const visible = getVisibleItemsInPage(page, 350, 200, 0);
    const hashes = visible.map((v) => v.hash);
    expect(hashes).not.toContain('b');
    expect(hashes).toContain('c');
    expect(hashes).not.toContain('d');
  });

  it('极端缩放：视口覆盖所有元素', () => {
    const visible = getVisibleItemsInPage(page, -1000, 5000);
    expect(visible).toHaveLength(6);
  });

  it('空页面返回空', () => {
    const emptyPage = makePage(0, []);
    const visible = getVisibleItemsInPage(emptyPage, 0, 500);
    expect(visible).toHaveLength(0);
  });
});

// ─── getVisibleItems (多分组) ──────────────────────────

describe('getVisibleItems', () => {
  const pageWidth = 1000;

  // 3 个分组，每组在不同 X 偏移
  const page0Items = [
    makeItem('a0', 0, 0, 100, 100, 1, 0),
    makeItem('a1', 0, 200, 100, 100, 1, 0),
  ];
  const page1Items = [
    makeItem('b0', 1000, 0, 100, 100, 2, 1),
    makeItem('b1', 1000, 200, 100, 100, 2, 1),
  ];
  const page2Items = [
    makeItem('c0', 2000, 0, 100, 100, 3, 2),
  ];

  const pages = [
    makePage(0, page0Items, pageWidth),
    makePage(1, page1Items, pageWidth),
    makePage(2, page2Items, pageWidth),
  ];

  it('只返回当前可见分组的元素', () => {
    // 视口完全在第一组范围内 (x=0~800, 不触碰第二组边界)
    const viewport: ViewportRect = { x: 0, y: 0, width: 800, height: 500 };
    const visible = getVisibleItems(pages, pageWidth, viewport);
    const hashes = visible.map(v => v.hash);
    expect(hashes).toContain('a0');
    expect(hashes).toContain('a1');
    expect(hashes).not.toContain('b0');
  });

  it('视口跨两组时返回两组元素', () => {
    // 视口在 500~1500 之间，跨第一组和第二组
    const viewport: ViewportRect = { x: 500, y: 0, width: 1000, height: 500 };
    const visible = getVisibleItems(pages, pageWidth, viewport);
    const hashes = visible.map(v => v.hash);
    expect(hashes).toContain('a0');
    expect(hashes).toContain('b0');
    expect(hashes).not.toContain('c0');
  });

  it('空 pages 返回空', () => {
    const viewport: ViewportRect = { x: 0, y: 0, width: 500, height: 500 };
    const visible = getVisibleItems([], pageWidth, viewport);
    expect(visible).toHaveLength(0);
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
