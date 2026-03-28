import { describe, it, expect } from 'vitest';
import {
  computeWaterfallLayout,
  computeHorizontalLayout,
  computeColumnWidth,
  DEFAULT_LAYOUT_CONFIG,
  type ImageDimension,
  type LayoutConfig,
} from './layout';
import type { GroupData } from '../types';

// ─── 测试工具 ─────────────────────────────────────────

function makeGroup(
  id: number,
  hashes: string[],
  name?: string,
): GroupData {
  return {
    id,
    name: name ?? `分组 ${id}`,
    imageCount: hashes.length,
    avgSimilarity: 0.9,
    representativeHash: hashes[0] ?? '',
    pictureHashes: hashes,
    pictureNames: hashes.map((h) => `${h}.nef`),
    picturePaths: hashes.map((h) => `/path/${h}.nef`),
  };
}

function makeDimensions(
  entries: [string, number, number][],
): Map<string, ImageDimension> {
  const map = new Map<string, ImageDimension>();
  for (const [hash, width, height] of entries) {
    map.set(hash, { width, height });
  }
  return map;
}

// ─── computeColumnWidth ──────────────────────────────

describe('computeColumnWidth', () => {
  it('应按公式计算列宽', () => {
    // viewportWidth=1000, paddingX=40*2=80, gapX=32 → available=920-32=888 → 920/2 - gap...
    // available = 1000 - 80 = 920, cols=2, gaps=32 → (920-32)/2 = 444
    const width = computeColumnWidth(1000);
    expect(width).toBeCloseTo(444);
  });

  it('不应低于最小列宽', () => {
    const width = computeColumnWidth(100);
    expect(width).toBe(DEFAULT_LAYOUT_CONFIG.minColumnWidth);
  });

  it('应支持自定义配置', () => {
    const config: LayoutConfig = {
      ...DEFAULT_LAYOUT_CONFIG,
      columns: 4,
      gapX: 10,
      paddingX: 20,
    };
    // available = 1000 - 40 = 960, (960-30)/4 = 232.5
    const width = computeColumnWidth(1000, config);
    expect(width).toBe(232.5);
  });
});

// ─── computeHorizontalLayout ──────────────────────────

describe('computeHorizontalLayout', () => {
  const viewportWidth = 1000;

  it('标准布局：所有图片获得正确坐标，内容居中', () => {
    const groups = [
      makeGroup(1, ['a', 'b', 'c', 'd', 'e', 'f']),
    ];
    const dims = makeDimensions([
      ['a', 3000, 2000],
      ['b', 2000, 3000],
      ['c', 4000, 3000],
      ['d', 1000, 1000],
      ['e', 3000, 2000],
      ['f', 2000, 3000],
    ]);

    const result = computeHorizontalLayout(groups, dims, viewportWidth);

    expect(result.items).toHaveLength(6);
    expect(result.groupTitles).toHaveLength(1);
    expect(result.totalHeight).toBeGreaterThan(0);
    expect(result.pages).toHaveLength(1);

    const colWidth = result.columnWidth;

    // 所有图片宽度等于列宽
    for (const item of result.items) {
      expect(item.width).toBe(colWidth);
    }

    // 内容居中: contentBlockWidth = 2*444 + 32 = 920, offsetX = (1000-920)/2 = 40
    const contentBlockWidth = 2 * colWidth + DEFAULT_LAYOUT_CONFIG.gapX;
    const expectedOffsetX = (viewportWidth - contentBlockWidth) / 2;
    expect(result.items[0].x).toBeCloseTo(expectedOffsetX);
    expect(result.items[0].y).toBe(DEFAULT_LAYOUT_CONFIG.paddingTop);

    // 第二张图片在第二列
    expect(result.items[1].x).toBeCloseTo(expectedOffsetX + colWidth + DEFAULT_LAYOUT_CONFIG.gapX);
  });

  it('最短列分配：图片应分配到高度最短的列', () => {
    const groups = [
      makeGroup(1, ['a', 'b', 'c', 'd']),
    ];
    const dims = makeDimensions([
      ['a', 3000, 2000],
      ['b', 1000, 1000],
      ['c', 3000, 2000],
      ['d', 3000, 2000],
    ]);

    const result = computeHorizontalLayout(groups, dims, viewportWidth);

    expect(result.items[2].x).toBe(result.items[0].x);
    expect(result.items[2].y).toBe(
      result.items[0].y + result.items[0].height + DEFAULT_LAYOUT_CONFIG.gapY,
    );
  });

  it('不同宽高比：高度按比例计算', () => {
    const groups = [makeGroup(1, ['a', 'b'])];
    const dims = makeDimensions([
      ['a', 4000, 3000],
      ['b', 1600, 900],
    ]);

    const result = computeHorizontalLayout(groups, dims, viewportWidth);
    const actualColWidth = result.items[0].width;

    expect(result.items[0].height).toBeCloseTo(actualColWidth * 3 / 4);
    expect(result.items[1].height).toBeCloseTo(actualColWidth * 900 / 1600);
  });

  it('缺失尺寸：回退到 3:2 默认比例', () => {
    const groups = [makeGroup(1, ['a'])];
    const dims = new Map<string, ImageDimension>();

    const result = computeHorizontalLayout(groups, dims, viewportWidth);
    const actualColWidth = result.items[0].width;

    expect(result.items[0].height).toBeCloseTo(actualColWidth * 2 / 3);
  });

  it('单图居中：单图使用全宽，居中在页面中', () => {
    const groups = [makeGroup(1, ['a'])];
    const dims = makeDimensions([['a', 3000, 2000]]);

    const result = computeHorizontalLayout(groups, dims, viewportWidth);

    // 单图用全可用宽度: 1000 - 80 = 920
    const expectedWidth = viewportWidth - DEFAULT_LAYOUT_CONFIG.paddingX * 2;
    expect(result.items[0].width).toBe(expectedWidth);
    // 居中: (1000-920)/2 = 40
    expect(result.items[0].x).toBeCloseTo((viewportWidth - expectedWidth) / 2);
  });

  it('空分组不影响其他组', () => {
    const groups = [
      makeGroup(1, []),
      makeGroup(2, ['a']),
    ];
    const dims = makeDimensions([['a', 3000, 2000]]);

    const result = computeHorizontalLayout(groups, dims, viewportWidth);

    expect(result.items).toHaveLength(1);
    expect(result.pages).toHaveLength(2);
  });

  it('单列退化：窗口极窄时列宽使用最小值', () => {
    const groups = [makeGroup(1, ['a', 'b'])];
    const dims = makeDimensions([
      ['a', 3000, 2000],
      ['b', 3000, 2000],
    ]);

    const result = computeHorizontalLayout(groups, dims, 100);

    expect(result.columnWidth).toBe(DEFAULT_LAYOUT_CONFIG.minColumnWidth);
  });

  it('多分组各在独立页面', () => {
    const groups = [
      makeGroup(1, ['a']),
      makeGroup(2, ['b']),
    ];
    const dims = makeDimensions([
      ['a', 3000, 2000],
      ['b', 3000, 2000],
    ]);

    const result = computeHorizontalLayout(groups, dims, viewportWidth);

    expect(result.totalWidth).toBe(2 * viewportWidth);
    expect(result.pages).toHaveLength(2);
  });

  it('没有分组时返回空结果', () => {
    const result = computeHorizontalLayout(
      [],
      new Map(),
      viewportWidth,
    );

    expect(result.items).toHaveLength(0);
    expect(result.groupTitles).toHaveLength(0);
    expect(result.pages).toHaveLength(0);
    expect(result.totalWidth).toBe(0);
  });

  it('分组标题标签正确', () => {
    const groups = [makeGroup(1, ['a', 'b'], '相似组 1')];
    const dims = makeDimensions([
      ['a', 3000, 2000],
      ['b', 3000, 2000],
    ]);

    const result = computeHorizontalLayout(groups, dims, viewportWidth);

    expect(result.groupTitles[0].label).toBe('相似组 1（2 张）');
  });

  it('所有 LayoutItem 的 groupId 和 groupIndex 正确', () => {
    const groups = [
      makeGroup(1, ['a', 'b']),
      makeGroup(2, ['c']),
    ];
    const dims = makeDimensions([
      ['a', 3000, 2000],
      ['b', 3000, 2000],
      ['c', 3000, 2000],
    ]);

    const result = computeHorizontalLayout(groups, dims, viewportWidth);

    expect(result.items[0].groupId).toBe(1);
    expect(result.items[0].groupIndex).toBe(0);
    expect(result.items[1].groupId).toBe(1);
    expect(result.items[1].groupIndex).toBe(0);
    expect(result.items[2].groupId).toBe(2);
    expect(result.items[2].groupIndex).toBe(1);
  });

  it('pageWidth 等于 viewportWidth', () => {
    const groups = [makeGroup(1, ['a'])];
    const dims = makeDimensions([['a', 3000, 2000]]);

    const result = computeHorizontalLayout(groups, dims, viewportWidth);
    expect(result.pageWidth).toBe(viewportWidth);
  });
});

// ─── computeWaterfallLayout (兼容别名) ─────────────────

describe('computeWaterfallLayout', () => {
  it('应与 computeHorizontalLayout 返回相同结果', () => {
    const groups = [makeGroup(1, ['a', 'b'])];
    const dims = makeDimensions([
      ['a', 3000, 2000],
      ['b', 3000, 2000],
    ]);

    const r1 = computeWaterfallLayout(groups, dims, 1000);
    const r2 = computeHorizontalLayout(groups, dims, 1000);

    expect(r1.items).toEqual(r2.items);
    expect(r1.groupTitles).toEqual(r2.groupTitles);
    expect(r1.totalWidth).toBe(r2.totalWidth);
  });
});
