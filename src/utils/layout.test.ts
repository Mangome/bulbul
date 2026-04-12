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
    // viewportWidth=1000, paddingX=24*2=48, thumbnailSize=160, gap=8
    // columns = floor((1000 - 48 + 8) / (160 + 8)) = floor(960/168) = 5
    // columnWidth = (1000 - 48 - 8*4) / 5 = (952 - 32) / 5 = 184
    const width = computeColumnWidth(1000);
    expect(width).toBe(184);
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
});

// ─── computeVerticalGridLayout ──────────────────────────

describe('computeVerticalGridLayout', () => {
  const viewportWidth = 1000;

  it('标准布局：所有图片获得正确坐标', () => {
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
    expect(result.groupTitles).toHaveLength(1);
    expect(result.totalHeight).toBeGreaterThan(0);
    expect(result.pages).toHaveLength(1);

    const colWidth = result.columnWidth;

    // 所有图片宽度等于列宽
    for (const item of result.items) {
      expect(item.width).toBe(colWidth);
    }

    // 分组标题标签正确
    expect(result.groupTitles[0].label).toBe('分组 1（6 张）');
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

    // 行高等于最高图的高度
    const heightA = result.items[0].height;
    const heightB = result.items[1].height;
    // a 更高（4:3 缩放后更高）
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

  it('空分组仅渲染标题区域', () => {
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

  it('多分组纵向排列', () => {
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
    // 第二个分组在第一个下方
    expect(result.pages[1].offsetY).toBeGreaterThan(result.pages[0].offsetY);
    // totalHeight 应该大于单个分组
    expect(result.totalHeight).toBeGreaterThan(result.pages[0].contentHeight);
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

  it('分组标题标签正确', () => {
    const groups = [makeGroup(1, ['a', 'b'], '相似组 1')];
    const dims = makeDimensions([
      ['a', 3000, 2000],
      ['b', 3000, 2000],
    ]);

    const result = computeVerticalGridLayout(groups, dims, viewportWidth);

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

    const result = computeVerticalGridLayout(groups, dims, viewportWidth);

    expect(result.items[0].groupId).toBe(1);
    expect(result.items[0].groupIndex).toBe(0);
    expect(result.items[1].groupId).toBe(1);
    expect(result.items[1].groupIndex).toBe(0);
    expect(result.items[2].groupId).toBe(2);
    expect(result.items[2].groupIndex).toBe(1);
  });

  it('最后一行居左排列', () => {
    // 创建一个组，图片数量不足以填满最后一行
    // viewportWidth=1000, thumbnailSize=160, gap=8, paddingX=24
    // columns = floor((1000 - 48 + 8) / (160 + 8)) = floor(960/168) = 5
    // 需要 7 张图：第一行 5 张，第二行 2 张
    const groups = [makeGroup(1, ['a', 'b', 'c', 'd', 'e', 'f', 'g'])];
    const dims = makeDimensions([
      ['a', 3000, 2000],
      ['b', 3000, 2000],
      ['c', 3000, 2000],
      ['d', 3000, 2000],
      ['e', 3000, 2000],
      ['f', 3000, 2000],
      ['g', 3000, 2000],
    ]);

    const result = computeVerticalGridLayout(groups, dims, viewportWidth);

    // 第二行第一张图 (f) 的 x 坐标应与第一行第一张图 (a) 相同
    expect(result.items[5].x).toBe(result.items[0].x);
    // 第二行第二张图 (g) 在第一张右边
    expect(result.items[6].x).toBeGreaterThan(result.items[5].x);
  });

  it('内容水平居中', () => {
    const groups = [makeGroup(1, ['a'])];
    const dims = makeDimensions([['a', 3000, 2000]]);

    const result = computeVerticalGridLayout(groups, dims, viewportWidth);

    // 图片应该有正的 x 坐标（居中偏移）
    expect(result.items[0].x).toBeGreaterThan(0);
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
});
