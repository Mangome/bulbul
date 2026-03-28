import { describe, it, expect } from 'vitest';
import {
  computeWaterfallLayout,
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
    // viewportWidth=1000, paddingLeft=280, paddingRight=30, gapX=32*1=32 → available=658 → 658/2=329
    const width = computeColumnWidth(1000);
    expect(width).toBeCloseTo(658 / 2);
  });

  it('不应低于最小列宽', () => {
    // 很窄的视口
    const width = computeColumnWidth(100);
    expect(width).toBe(DEFAULT_LAYOUT_CONFIG.minColumnWidth);
  });

  it('应支持自定义配置', () => {
    const config: LayoutConfig = {
      ...DEFAULT_LAYOUT_CONFIG,
      columns: 4,
      gapX: 10,
      paddingLeft: 20,
      paddingRight: 20,
    };
    // available = 1000 - 20 - 20 - 30 = 930 → 930/4 = 232.5
    const width = computeColumnWidth(1000, config);
    expect(width).toBe(232.5);
  });
});

// ─── computeWaterfallLayout ──────────────────────────

describe('computeWaterfallLayout', () => {
  const viewportWidth = 1000;

  it('标准布局：所有图片获得正确坐标', () => {
    const groups = [
      makeGroup(1, ['a', 'b', 'c', 'd', 'e', 'f']),
    ];
    const dims = makeDimensions([
      ['a', 3000, 2000], // 3:2
      ['b', 2000, 3000], // 2:3
      ['c', 4000, 3000], // 4:3
      ['d', 1000, 1000], // 1:1
      ['e', 3000, 2000], // 3:2
      ['f', 2000, 3000], // 2:3
    ]);

    const result = computeWaterfallLayout(groups, dims, viewportWidth);

    expect(result.items).toHaveLength(6);
    expect(result.groupTitles).toHaveLength(1);
    expect(result.totalHeight).toBeGreaterThan(0);

    const colWidth = result.columnWidth;

    // 所有图片宽度等于列宽
    for (const item of result.items) {
      expect(item.width).toBe(colWidth);
    }

    // 第一张图片在第一列, 标题下方
    expect(result.items[0].x).toBe(280); // paddingLeft=280
    expect(result.items[0].y).toBe(48); // groupTitleHeight=48

    // 第二张图片在第二列
    expect(result.items[1].x).toBe(280 + colWidth + 32); // paddingLeft + columnWidth + gapX
  });

  it('最短列分配：图片应分配到高度最短的列', () => {
    // 2 列模式（默认列数=2），4 张图片交替分配
    // 前 2 张各占 1 列，第 3、4 张分配到较短列
    const groups = [
      makeGroup(1, ['a', 'b', 'c', 'd']),
    ];
    const dims = makeDimensions([
      ['a', 3000, 2000], // 3:2 → 较矮
      ['b', 1000, 1000], // 1:1 → 较高
      ['c', 3000, 2000], // 3:2
      ['d', 3000, 2000], // 3:2
    ]);

    const result = computeWaterfallLayout(groups, dims, viewportWidth);

    // c 应在第一列 (与 a 同列，a 较矮)
    expect(result.items[2].x).toBe(result.items[0].x);
    // c 的 y 应在 a 的底部 + gapY
    expect(result.items[2].y).toBe(
      result.items[0].y + result.items[0].height + DEFAULT_LAYOUT_CONFIG.gapY,
    );
  });

  it('不同宽高比：高度按比例计算', () => {
    // 2 张图片 → 2 列模式
    const groups = [makeGroup(1, ['a', 'b'])];
    const dims = makeDimensions([
      ['a', 4000, 3000], // 4:3
      ['b', 1600, 900], // 16:9
    ]);

    const result = computeWaterfallLayout(groups, dims, viewportWidth);
    // 2 列模式下的实际列宽
    const actualColWidth = result.items[0].width;

    expect(result.items[0].height).toBeCloseTo(actualColWidth * 3 / 4);
    expect(result.items[1].height).toBeCloseTo(actualColWidth * 900 / 1600);
  });

  it('缺失尺寸：回退到 3:2 默认比例', () => {
    const groups = [makeGroup(1, ['a'])];
    const dims = new Map<string, ImageDimension>(); // 空：无尺寸信息

    const result = computeWaterfallLayout(groups, dims, viewportWidth);
    // 单图分组 → 1 列模式，实际列宽可能受 maxSingleColumnWidth 限制
    const actualColWidth = result.items[0].width;

    // 默认 3:2 → h = colWidth * 2/3
    expect(result.items[0].height).toBeCloseTo(actualColWidth * 2 / 3);
  });

  it('空分组：仅预留标题区域', () => {
    const groups = [
      makeGroup(1, []),
      makeGroup(2, ['a']),
    ];
    const dims = makeDimensions([['a', 3000, 2000]]);

    const result = computeWaterfallLayout(groups, dims, viewportWidth);

    expect(result.items).toHaveLength(1);
    expect(result.groupTitles).toHaveLength(2);

    // 第二个分组的标题 y 应在第一个分组标题之后 + 标题高度 + 分组间距
    const title1 = result.groupTitles[0];
    const title2 = result.groupTitles[1];
    expect(title2.y).toBeCloseTo(
      title1.y + DEFAULT_LAYOUT_CONFIG.groupTitleHeight + DEFAULT_LAYOUT_CONFIG.groupGap,
    );
  });

  it('单列退化：窗口极窄时列宽使用最小值', () => {
    const groups = [makeGroup(1, ['a', 'b'])];
    const dims = makeDimensions([
      ['a', 3000, 2000],
      ['b', 3000, 2000],
    ]);

    const result = computeWaterfallLayout(groups, dims, 100);

    expect(result.columnWidth).toBe(DEFAULT_LAYOUT_CONFIG.minColumnWidth);
  });

  it('多分组间距正确', () => {
    const groups = [
      makeGroup(1, ['a']),
      makeGroup(2, ['b']),
    ];
    const dims = makeDimensions([
      ['a', 3000, 2000],
      ['b', 3000, 2000],
    ]);

    const result = computeWaterfallLayout(groups, dims, viewportWidth);
    // 单图分组 → 1 列模式
    const actualColWidth = result.items[0].width;
    const imgHeight = actualColWidth * 2 / 3; // 3:2 比例

    // 分组1：标题 y=0, 图片 y=48, 图片底部=48+imgHeight
    // 列高 = 48 + imgHeight + 28(gapY)
    // 分组2起始 = 列高 + 80(groupGap)
    const expectedColHeight = 48 + imgHeight + 28;
    const group2Title = result.groupTitles[1];
    expect(group2Title.y).toBeCloseTo(expectedColHeight + DEFAULT_LAYOUT_CONFIG.groupGap);
  });

  it('没有分组时返回空结果', () => {
    const result = computeWaterfallLayout(
      [],
      new Map(),
      viewportWidth,
    );

    expect(result.items).toHaveLength(0);
    expect(result.groupTitles).toHaveLength(0);
    expect(result.totalHeight).toBe(0);
  });

  it('分组标题标签正确', () => {
    const groups = [makeGroup(1, ['a', 'b'], '相似组 1')];
    const dims = makeDimensions([
      ['a', 3000, 2000],
      ['b', 3000, 2000],
    ]);

    const result = computeWaterfallLayout(groups, dims, viewportWidth);

    expect(result.groupTitles[0].label).toBe('相似组 1（2 张）');
  });

  it('所有 LayoutItem 的 groupId 正确', () => {
    const groups = [
      makeGroup(1, ['a', 'b']),
      makeGroup(2, ['c']),
    ];
    const dims = makeDimensions([
      ['a', 3000, 2000],
      ['b', 3000, 2000],
      ['c', 3000, 2000],
    ]);

    const result = computeWaterfallLayout(groups, dims, viewportWidth);

    expect(result.items[0].groupId).toBe(1);
    expect(result.items[1].groupId).toBe(1);
    expect(result.items[2].groupId).toBe(2);
  });
});
