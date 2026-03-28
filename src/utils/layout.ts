// ============================================================
// 瀑布流布局引擎
//
// 接收分组数据 + 图片尺寸信息 + 视口宽度，
// 一次性预计算所有图片的绝对坐标，供画布渲染和视口裁剪使用。
//
// 每个分组根据图片数量动态决定列数：
// - 1 张 → 1 列（大图展示）
// - 2 张 → 2 列
// - 3+ 张 → 使用配置的最大列数
// ============================================================

import type { GroupData } from '../types';

// ─── 配置 ─────────────────────────────────────────────

/** 布局固定配置参数 */
export interface LayoutConfig {
  /** 最大列数 */
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
  /** 单图最大宽度 (px) — 防止 1 列模式下图片过大 */
  readonly maxSingleColumnWidth: number;
  /** 分组之间的垂直间距 (px) */
  readonly groupGap: number;
  /** 分组标题区域高度 (px) */
  readonly groupTitleHeight: number;
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  columns: 2,
  gapX: 32,
  gapY: 28,
  paddingLeft: 280,
  paddingRight: 30,
  minColumnWidth: 200,
  maxSingleColumnWidth: Infinity,
  groupGap: 80,
  groupTitleHeight: 48,
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
 * 计算指定列数下的列宽
 */
export function computeColumnWidth(
  viewportWidth: number,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): number {
  return computeColumnWidthForColumns(viewportWidth, config.columns, config);
}

/**
 * 针对指定列数计算列宽
 */
function computeColumnWidthForColumns(
  viewportWidth: number,
  columns: number,
  config: LayoutConfig,
): number {
  const availableWidth =
    viewportWidth - config.paddingLeft - config.paddingRight - config.gapX * (columns - 1);
  const rawWidth = availableWidth / columns;

  // 单列模式下限制最大宽度，防止图片过大
  if (columns === 1) {
    return Math.max(config.minColumnWidth, Math.min(rawWidth, config.maxSingleColumnWidth));
  }

  return Math.max(config.minColumnWidth, rawWidth);
}

/**
 * 一次性全量计算瀑布流布局
 *
 * 每个分组根据图片数量动态决定列数，充分利用可视区域。
 * 算法复杂度: O(n)
 */
export function computeWaterfallLayout(
  groups: GroupData[],
  imageDimensions: Map<string, ImageDimension>,
  viewportWidth: number,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): LayoutResult {
  const defaultColumnWidth = computeColumnWidth(viewportWidth, config);
  const items: LayoutItem[] = [];
  const groupTitles: GroupTitleItem[] = [];

  // 各列当前高度 (从 0 开始)
  let columnHeights = new Array<number>(config.columns).fill(0);
  let prevColumns = config.columns;
  let isFirstGroup = true;

  for (const group of groups) {
    // 根据分组图片数量动态调整列数
    const groupColumns = Math.min(group.pictureHashes.length || 1, config.columns);
    const groupColumnWidth = computeColumnWidthForColumns(viewportWidth, groupColumns, config);

    // ── 分组间距 ──
    const maxColumnHeight = Math.max(...columnHeights.slice(0, prevColumns));
    if (!isFirstGroup) {
      const groupStartY = maxColumnHeight + config.groupGap;
      columnHeights = new Array<number>(groupColumns).fill(groupStartY);
    } else {
      columnHeights = new Array<number>(groupColumns).fill(0);
    }
    isFirstGroup = false;
    prevColumns = groupColumns;

    // ── 分组标题 ──
    const titleY = columnHeights[0];
    groupTitles.push({
      groupId: group.id,
      label: `${group.name}（${group.imageCount} 张）`,
      x: config.paddingLeft,
      y: titleY,
      width: groupColumns * groupColumnWidth + (groupColumns - 1) * config.gapX,
      height: config.groupTitleHeight,
    });

    // 标题区域下移
    for (let c = 0; c < groupColumns; c++) {
      columnHeights[c] += config.groupTitleHeight;
    }

    // ── 空分组：仅标题，不分配图片空间 ──
    if (group.pictureHashes.length === 0) {
      continue;
    }

    // ── 瀑布流分配图片 ──
    for (const hash of group.pictureHashes) {
      const shortestCol = findShortestColumn(columnHeights);

      const dim = imageDimensions.get(hash);
      const aspectRatio = dim
        ? dim.width / dim.height
        : DEFAULT_ASPECT_RATIO;

      const renderHeight = groupColumnWidth / aspectRatio;

      const x =
        config.paddingLeft + shortestCol * (groupColumnWidth + config.gapX);
      const y = columnHeights[shortestCol];

      items.push({
        hash,
        groupId: group.id,
        x,
        y,
        width: groupColumnWidth,
        height: renderHeight,
      });

      columnHeights[shortestCol] += renderHeight + config.gapY;
    }
  }

  const totalHeight = Math.max(...columnHeights, 0);

  return { items, groupTitles, totalHeight, columnWidth: defaultColumnWidth };
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
