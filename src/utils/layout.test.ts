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
    // viewportWidth=1000, padding=30*2=60, gapX=20*2=40 → available=900 → 900/3=300
    const width = computeColumnWidth(1000);
    expect(width).toBe(300);
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
      padding: 20,
    };
    // available = 1000 - 40 - 30 = 930 → 930/4 = 232.5
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
    expect(result.columnWidth).toBe(300);

    // 所有图片宽度等于列宽
    for (const item of result.items) {
      expect(item.width).toBe(300);
    }

    // 第一张图片在第一列, 标题下方
    expect(result.items[0].x).toBe(30); // padding=30
    expect(result.items[0].y).toBe(40); // groupTitleHeight=40

    // 第二张图片在第二列
    expect(result.items[1].x).toBe(30 + 300 + 20); // padding + columnWidth + gapX

    // 第三张图片在第三列
    expect(result.items[2].x).toBe(30 + (300 + 20) * 2);
  });

  it('最短列分配：图片应分配到高度最短的列', () => {
    // 3 张不同高度的图片填满 3 列后，第 4 张应落在最短列
    const groups = [
      makeGroup(1, ['a', 'b', 'c', 'd']),
    ];
    // a: 3:2 → h=200, b: 1:1 → h=300, c: 2:3 → h=450
    // 第4张 d 应该落在 a 所在列(最短，高度 200+20=220)
    const dims = makeDimensions([
      ['a', 3000, 2000], // h = 300 * (2000/3000) = 200
      ['b', 1000, 1000], // h = 300
      ['c', 2000, 3000], // h = 450
      ['d', 3000, 2000], // h = 200
    ]);

    const result = computeWaterfallLayout(groups, dims, viewportWidth);

    // d 应在第一列 (与 a 同列)
    expect(result.items[3].x).toBe(result.items[0].x);
    // d 的 y 应在 a 的底部 + gapY
    expect(result.items[3].y).toBe(
      result.items[0].y + result.items[0].height + DEFAULT_LAYOUT_CONFIG.gapY,
    );
  });

  it('不同宽高比：高度按比例计算', () => {
    const groups = [makeGroup(1, ['a', 'b'])];
    const dims = makeDimensions([
      ['a', 4000, 3000], // 4:3 → h = 300 * 3/4 = 225
      ['b', 1600, 900], // 16:9 → h = 300 * 900/1600 = 168.75
    ]);

    const result = computeWaterfallLayout(groups, dims, viewportWidth);

    expect(result.items[0].height).toBeCloseTo(225);
    expect(result.items[1].height).toBeCloseTo(168.75);
  });

  it('缺失尺寸：回退到 3:2 默认比例', () => {
    const groups = [makeGroup(1, ['a'])];
    const dims = new Map<string, ImageDimension>(); // 空：无尺寸信息

    const result = computeWaterfallLayout(groups, dims, viewportWidth);

    // 默认 3:2 → h = 300 * 2/3 = 200
    expect(result.items[0].height).toBeCloseTo(200);
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
    expect(title2.y).toBe(
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
      ['a', 3000, 2000], // h=200
      ['b', 3000, 2000],
    ]);

    const result = computeWaterfallLayout(groups, dims, viewportWidth);

    // 分组1：标题 y=0, 图片 y=40, 图片底部=40+200=240
    // 分组2：标题 y = 240 + 20(gapY后的列高) + 60(groupGap) 应该是 
    // 列高 = 40 + 200 + 20 = 260, 分组2起始 = 260 + 60 = 320
    const group2Title = result.groupTitles[1];
    expect(group2Title.y).toBe(260 + DEFAULT_LAYOUT_CONFIG.groupGap);
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
