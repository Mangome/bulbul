// ============================================================
// 瀑布流布局引擎
//
// 接收分组数据 + 图片尺寸信息 + 视口宽度，
// 一次性预计算所有图片的绝对坐标，供画布渲染和视口裁剪使用。
// ============================================================

import type { GroupData } from '../types';

// ─── 配置 ─────────────────────────────────────────────

/** 布局固定配置参数 */
export interface LayoutConfig {
  /** 列数 */
  readonly columns: number;
  /** 水平间距 (px) */
  readonly gapX: number;
  /** 垂直间距 (px) */
  readonly gapY: number;
  /** 左边距 (px) — 为左侧浮动面板预留空间 */
  readonly paddingLeft: number;
  /** 右边距 (px) */
  readonly paddingRight: number;
  /** 最小列宽 (px) */
  readonly minColumnWidth: number;
  /** 分组之间的垂直间距 (px) */
  readonly groupGap: number;
  /** 分组标题区域高度 (px) */
  readonly groupTitleHeight: number;
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  columns: 3,
  gapX: 20,
  gapY: 20,
  paddingLeft: 280,
  paddingRight: 30,
  minColumnWidth: 200,
  groupGap: 60,
  groupTitleHeight: 40,
};

// ─── 类型定义 ─────────────────────────────────────────

/** 图片尺寸信息 */
export interface ImageDimension {
  width: number;
  height: number;
}

/** 布局计算结果中的单个元素 */
export interface LayoutItem {
  /** 图片 hash */
  hash: string;
  /** 所属分组 ID */
  groupId: number;
  /** 绝对 X 坐标 */
  x: number;
  /** 绝对 Y 坐标 */
  y: number;
  /** 渲染宽度 */
  width: number;
  /** 渲染高度 */
  height: number;
}

/** 分组标题布局信息 */
export interface GroupTitleItem {
  groupId: number;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 完整的布局计算结果 */
export interface LayoutResult {
  items: LayoutItem[];
  groupTitles: GroupTitleItem[];
  totalHeight: number;
  columnWidth: number;
}

// ─── 默认宽高比 ──────────────────────────────────────

/** 缺失尺寸时的默认宽高比 (3:2) */
const DEFAULT_ASPECT_RATIO = 3 / 2;

// ─── 核心算法 ─────────────────────────────────────────

/**
 * 计算列宽
 *
 * columnWidth = max(minColumnWidth, (viewportWidth - padding*2 - gapX*(columns-1)) / columns)
 */
export function computeColumnWidth(
  viewportWidth: number,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): number {
  const availableWidth =
    viewportWidth - config.paddingLeft - config.paddingRight - config.gapX * (config.columns - 1);
  return Math.max(config.minColumnWidth, availableWidth / config.columns);
}

/**
 * 一次性全量计算瀑布流布局
 *
 * 算法复杂度: O(n) — 逐图片遍历，每次选择最短列 (列数固定为常数)
 */
export function computeWaterfallLayout(
  groups: GroupData[],
  imageDimensions: Map<string, ImageDimension>,
  viewportWidth: number,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): LayoutResult {
  const columnWidth = computeColumnWidth(viewportWidth, config);
  const items: LayoutItem[] = [];
  const groupTitles: GroupTitleItem[] = [];

  // 各列当前高度 (从 0 开始)
  const columnHeights = new Array<number>(config.columns).fill(0);

  // 用于跟踪是否为第一个分组
  let isFirstGroup = true;

  for (const group of groups) {
    // ── 分组间距 ──
    const maxColumnHeight = Math.max(...columnHeights);
    if (!isFirstGroup) {
      // 非第一个分组：所有列对齐到最高列 + 分组间距
      const groupStartY = maxColumnHeight + config.groupGap;
      columnHeights.fill(groupStartY);
    }
    isFirstGroup = false;

    // ── 分组标题 ──
    const titleY = columnHeights[0]; // 所有列此时等高
    groupTitles.push({
      groupId: group.id,
      label: `${group.name}（${group.imageCount} 张）`,
      x: config.paddingLeft,
      y: titleY,
      width: viewportWidth - config.paddingLeft - config.paddingRight,
      height: config.groupTitleHeight,
    });

    // 标题区域下移
    for (let c = 0; c < config.columns; c++) {
      columnHeights[c] += config.groupTitleHeight;
    }

    // ── 空分组：仅标题，不分配图片空间 ──
    if (group.pictureHashes.length === 0) {
      continue;
    }

    // ── 瀑布流分配图片 ──
    for (const hash of group.pictureHashes) {
      // 查找最短列
      const shortestCol = findShortestColumn(columnHeights);

      // 获取图片宽高比
      const dim = imageDimensions.get(hash);
      const aspectRatio = dim
        ? dim.width / dim.height
        : DEFAULT_ASPECT_RATIO;

      // 计算渲染高度
      const renderHeight = columnWidth / aspectRatio;

      // 计算绝对坐标
      const x =
        config.paddingLeft + shortestCol * (columnWidth + config.gapX);
      const y = columnHeights[shortestCol];

      items.push({
        hash,
        groupId: group.id,
        x,
        y,
        width: columnWidth,
        height: renderHeight,
      });

      // 更新列高度 (图片高度 + 垂直间距)
      columnHeights[shortestCol] += renderHeight + config.gapY;
    }
  }

  const totalHeight = Math.max(...columnHeights, 0);

  return { items, groupTitles, totalHeight, columnWidth };
}

// ─── 内部辅助 ─────────────────────────────────────────

/** 查找当前最短列的索引 */
function findShortestColumn(columnHeights: number[]): number {
  let minIndex = 0;
  for (let i = 1; i < columnHeights.length; i++) {
    if (columnHeights[i] < columnHeights[minIndex]) {
      minIndex = i;
    }
  }
  return minIndex;
}
