import { describe, it, expect } from 'vitest';
import {
  computeVerticalGridLayout,
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
    // viewportWidth=1000, paddingX=32*2=64, thumbnailSize=450, gap=12
    // columns = floor((1000 - 64 + 12) / (450 + 12)) = floor(948/462) = 2
    // columnWidth = (1000 - 64 - 12*1) / 2 = 924 / 2 = 462
    const width = computeColumnWidth(1000);
    expect(width).toBe(462);
  });

  it('应支持自定义配置', () => {
    const config: LayoutConfig = {
      ...DEFAULT_LAYOUT_CONFIG,
      thumbnailSize: 200,
      gap: 10,
      paddingX: 20,
    };
    // columns = floor((1000 - 40 + 10) / (200 + 10)) = floor(970/210) = 4
    // columnWidth = (1000 - 40 - 10*3) / 4 = (960 - 30) / 4 = 232.5
    const width = computeColumnWidth(1000, config);
    expect(width).toBe(232.5);
  });

  it('列数不应超过 maxColumns', () => {
    const config: LayoutConfig = {
      ...DEFAULT_LAYOUT_CONFIG,
      thumbnailSize: 100,
      gap: 5,
      paddingX: 10,
      maxColumns: 5,
    };
    // viewportWidth=2000 → raw columns = floor((2000-20+5)/(100+5)) = floor(1985/105) = 18
    // 钳制到 5
    // columnWidth = (2000 - 20 - 5*4) / 5 = (1980 - 20) / 5 = 392
    const width = computeColumnWidth(2000, config);
    expect(width).toBe(392);
  });

  it('列数不应低于 minColumns', () => {
    const config: LayoutConfig = {
      ...DEFAULT_LAYOUT_CONFIG,
      thumbnailSize: 1000,
      gap: 10,
      paddingX: 10,
      minColumns: 1,
    };
    // viewportWidth=200 → raw = floor((200-20+10)/(1000+10)) = floor(190/1010) = 0
    // 钳制到 1
    // columnWidth = (200 - 20 - 0) / 1 = 180
    const width = computeColumnWidth(200, config);
    expect(width).toBe(180);
  });
});

// ─── computeVerticalGridLayout ──────────────────────────

describe('computeVerticalGridLayout', () => {
  const viewportWidth = 1000;

  it('连续排列：所有图片获得正确坐标', () => {
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

    const result = computeVerticalGridLayout(groups, dims, viewportWidth);

    expect(result.items).toHaveLength(6);
    expect(result.groupTitles).toHaveLength(0);
    expect(result.totalHeight).toBeGreaterThan(0);
    expect(result.pages).toHaveLength(1);

    const colWidth = result.columnWidth;

    // 所有图片宽度等于列宽
    for (const item of result.items) {
      expect(item.width).toBe(colWidth);
    }
  });

  it('行式网格：同行图片等宽，行高等于最高图', () => {
    const groups = [
      makeGroup(1, ['a', 'b']),
    ];
    const dims = makeDimensions([
      ['a', 4000, 3000],  // 横向 4:3
      ['b', 1600, 900],   // 横向 16:9（更矮）
    ]);

    const result = computeVerticalGridLayout(groups, dims, viewportWidth);

    // 同行两张图等宽
    expect(result.items[0].width).toBe(result.items[1].width);

    // a 更高（4:3 缩放后更高）
    const heightA = result.items[0].height;
    const heightB = result.items[1].height;
    expect(heightA).toBeGreaterThan(heightB);
  });

  it('不同宽高比：高度按比例计算', () => {
    const groups = [makeGroup(1, ['a', 'b'])];
    const dims = makeDimensions([
      ['a', 4000, 3000],
      ['b', 1600, 900],
    ]);

    const result = computeVerticalGridLayout(groups, dims, viewportWidth);
    const actualColWidth = result.items[0].width;

    expect(result.items[0].height).toBeCloseTo(actualColWidth * 3 / 4);
    expect(result.items[1].height).toBeCloseTo(actualColWidth * 900 / 1600);
  });

  it('缺失尺寸：回退到 3:2 默认比例', () => {
    const groups = [makeGroup(1, ['a'])];
    const dims = new Map<string, ImageDimension>();

    const result = computeVerticalGridLayout(groups, dims, viewportWidth);
    const actualColWidth = result.items[0].width;

    expect(result.items[0].height).toBeCloseTo(actualColWidth * 2 / 3);
  });

  it('空分组被跳过', () => {
    const groups = [
      makeGroup(1, []),
      makeGroup(2, ['a']),
    ];
    const dims = makeDimensions([['a', 3000, 2000]]);

    const result = computeVerticalGridLayout(groups, dims, viewportWidth);

    expect(result.items).toHaveLength(1);
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].items).toHaveLength(0);
    expect(result.pages[1].items).toHaveLength(1);
  });

  it('多分组连续排列', () => {
    const groups = [
      makeGroup(1, ['a']),
      makeGroup(2, ['b']),
    ];
    const dims = makeDimensions([
      ['a', 3000, 2000],
      ['b', 3000, 2000],
    ]);

    const result = computeVerticalGridLayout(groups, dims, viewportWidth);

    expect(result.pages).toHaveLength(2);
    expect(result.totalHeight).toBeGreaterThan(0);

    // 所有图片宽度一致
    expect(result.items[0].width).toBe(result.items[1].width);
  });

  it('没有分组时返回空结果', () => {
    const result = computeVerticalGridLayout(
      [],
      new Map(),
      viewportWidth,
    );

    expect(result.items).toHaveLength(0);
    expect(result.groupTitles).toHaveLength(0);
    expect(result.pages).toHaveLength(0);
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

    const result = computeVerticalGridLayout(groups, dims, viewportWidth);

    expect(result.items[0].groupId).toBe(1);
    expect(result.items[0].groupIndex).toBe(0);
    expect(result.items[1].groupId).toBe(1);
    expect(result.items[1].groupIndex).toBe(0);
    expect(result.items[2].groupId).toBe(2);
    expect(result.items[2].groupIndex).toBe(1);
  });

  it('最后一行居左排列', () => {
    // viewportWidth=1000 → 2 columns
    // 3 张图：第一行 2 张，第二行 1 张
    const groups = [makeGroup(1, ['a', 'b', 'c'])];
    const dims = makeDimensions([
      ['a', 3000, 2000],
      ['b', 3000, 2000],
      ['c', 3000, 2000],
    ]);

    const result = computeVerticalGridLayout(groups, dims, viewportWidth);

    // 最后一行第一张图 (c) 的 x 坐标应与第一行第一张图 (a) 相同
    expect(result.items[2].x).toBe(result.items[0].x);
  });

  it('所有分组的 columnWidth 一致', () => {
    const groups = [
      makeGroup(1, ['a']),
      makeGroup(2, ['b', 'c']),
    ];
    const dims = makeDimensions([
      ['a', 3000, 2000],
      ['b', 3000, 2000],
      ['c', 3000, 2000],
    ]);

    const result = computeVerticalGridLayout(groups, dims, viewportWidth);

    expect(result.pages[0].columnWidth).toBe(result.pages[1].columnWidth);
    expect(result.columnWidth).toBe(result.pages[0].columnWidth);
  });

  // ─── isFirstInGroup 角标 ─────────────────────────────────

  it('每组第一张图 isFirstInGroup=true，其余为 false', () => {
    const groups = [
      makeGroup(1, ['a', 'b']),
      makeGroup(2, ['c']),
      makeGroup(3, ['d', 'e', 'f']),
    ];
    const dims = makeDimensions([
      ['a', 3000, 2000], ['b', 3000, 2000],
      ['c', 3000, 2000],
      ['d', 3000, 2000], ['e', 3000, 2000], ['f', 3000, 2000],
    ]);

    const result = computeVerticalGridLayout(groups, dims, viewportWidth);

    // a=first, b=not
    expect(result.items[0].isFirstInGroup).toBe(true);
    expect(result.items[0].groupLabel).toContain('G1');
    expect(result.items[1].isFirstInGroup).toBe(false);
    expect(result.items[1].groupLabel).toBe('');

    // c=first
    expect(result.items[2].isFirstInGroup).toBe(true);
    expect(result.items[2].groupLabel).toContain('G2');

    // d=first, e=not, f=not
    expect(result.items[3].isFirstInGroup).toBe(true);
    expect(result.items[3].groupLabel).toContain('G3');
    expect(result.items[4].isFirstInGroup).toBe(false);
    expect(result.items[5].isFirstInGroup).toBe(false);
  });

  it('groupLabel 格式正确', () => {
    const groups = [
      makeGroup(1, ['a']),
      makeGroup(2, ['b', 'c', 'd']),
    ];
    const dims = makeDimensions([
      ['a', 3000, 2000],
      ['b', 3000, 2000], ['c', 3000, 2000], ['d', 3000, 2000],
    ]);

    const result = computeVerticalGridLayout(groups, dims, viewportWidth);

    expect(result.items[0].groupLabel).toBe('G1 · 1张');
    expect(result.items[1].groupLabel).toBe('G2 · 3张');
  });

  // ─── 跨分组连续排列 ─────────────────────────────────

  it('跨分组图片在同一行连续排列', () => {
    // viewportWidth=1000 → 2 columns
    // 分组1: 1张, 分组2: 1张 → 应在同一行
    const groups = [
      makeGroup(1, ['a']),
      makeGroup(2, ['b']),
    ];
    const dims = makeDimensions([
      ['a', 3000, 2000],
      ['b', 3000, 2000],
    ]);

    const result = computeVerticalGridLayout(groups, dims, viewportWidth);

    // 两张图 Y 坐标相同（同一行）
    expect(result.items[0].y).toBe(result.items[1].y);
    // X 坐标不同（不同列）
    expect(result.items[0].x).not.toBe(result.items[1].x);
  });

  it('不再有 groupTitles', () => {
    const groups = [
      makeGroup(1, ['a']),
      makeGroup(2, ['b', 'c']),
    ];
    const dims = makeDimensions([
      ['a', 3000, 2000],
      ['b', 3000, 2000],
      ['c', 3000, 2000],
    ]);

    const result = computeVerticalGridLayout(groups, dims, viewportWidth);

    expect(result.groupTitles).toEqual([]);
  });

  // ─── 列数限制 ─────────────────────────────────

  it('列数不超过 maxColumns', () => {
    const config: LayoutConfig = {
      ...DEFAULT_LAYOUT_CONFIG,
      thumbnailSize: 100,
      maxColumns: 3,
    };
    // viewportWidth=2000 → raw columns 很大，但限制到 3
    const groups = [makeGroup(1, ['a', 'b', 'c', 'd'])];
    const dims = makeDimensions([
      ['a', 3000, 2000], ['b', 3000, 2000], ['c', 3000, 2000], ['d', 3000, 2000],
    ]);

    const result = computeVerticalGridLayout(groups, dims, 2000, config);

    // 第4张图应该在第二行（列数限制为3）
    expect(result.items[3].y).toBeGreaterThan(result.items[0].y);
  });

  it('列数至少为 minColumns', () => {
    const config: LayoutConfig = {
      ...DEFAULT_LAYOUT_CONFIG,
      thumbnailSize: 1000,
      minColumns: 1,
    };
    // viewportWidth=200 → raw columns = 0，但限制到 1
    const groups = [makeGroup(1, ['a'])];
    const dims = makeDimensions([['a', 3000, 2000]]);

    const result = computeVerticalGridLayout(groups, dims, 200, config);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].width).toBeGreaterThan(0);
  });

  // ─── page offsetY 用于虚拟化 ─────────────────────────

  it('page 的 offsetY 和 contentHeight 正确', () => {
    const groups = [
      makeGroup(1, ['a', 'b']),
      makeGroup(2, ['c', 'd']),
    ];
    const dims = makeDimensions([
      ['a', 3000, 2000], ['b', 3000, 2000],
      ['c', 3000, 2000], ['d', 3000, 2000],
    ]);

    const result = computeVerticalGridLayout(groups, dims, viewportWidth);

    for (const page of result.pages) {
      if (page.items.length === 0) continue;

      // offsetY 应该是该 page 中最小的 item.y
      const minItemY = Math.min(...page.items.map(i => i.y));
      expect(page.offsetY).toBe(minItemY);

      // contentHeight 应该覆盖所有 items
      const maxBottom = Math.max(...page.items.map(i => i.y + i.height));
      expect(page.contentHeight).toBe(maxBottom - page.offsetY);
    }
  });
});
