// ============================================================
// 水平分组布局引擎
//
// 接收分组数据 + 图片尺寸信息 + 视口尺寸，
// 一次性预计算所有图片的绝对坐标，供画布渲染和视口裁剪使用。
//
// 每个分组占据一个「页面」（viewportWidth），
// 页面内使用 2 列网格纵向排列，内容水平居中。
// 分组之间水平排列，通过左右切换导航。
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
  /** 页面水平最小边距 (px) — 内容居中后的最小留白 */
  readonly paddingX: number;
  /** 最小列宽 (px) */
  readonly minColumnWidth: number;
  /** 单图最大宽度 (px) — 防止 1 列模式下图片过大 */
  readonly maxSingleColumnWidth: number;
  /** 分组之间的垂直间距 (px) — 水平模式下不使用 */
  readonly groupGap: number;
  /** 页面顶部内边距 (px) */
  readonly paddingTop: number;
  /** 页面底部内边距 (px) */
  readonly paddingBottom: number;
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  columns: 2,
  gapX: 32,
  gapY: 28,
  paddingX: 40,
  minColumnWidth: 200,
  maxSingleColumnWidth: Infinity,
  groupGap: 80,
  paddingTop: 24,
  paddingBottom: 24,
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
  /** 所属分组索引 (0-based) */
  groupIndex: number;
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

/** 单个分组页面的布局 */
export interface GroupPageLayout {
  /** 分组在 groups 数组中的索引 */
  groupIndex: number;
  /** 分组 ID */
  groupId: number;
  /** 该分组页面的起始 X 偏移 */
  offsetX: number;
  /** 该分组内容的总高度 */
  contentHeight: number;
  /** 该分组包含的所有 LayoutItem */
  items: LayoutItem[];
  /** 分组标题 */
  groupTitle: GroupTitleItem;
  /** 按 Y 坐标排序的 LayoutItem 引用 (用于组内虚拟化) */
  sortedItems: LayoutItem[];
}

/** 完整的水平布局计算结果 */
export interface LayoutResult {
  /** 所有 LayoutItem（用于全局查询） */
  items: LayoutItem[];
  /** 所有分组标题 */
  groupTitles: GroupTitleItem[];
  /** 分组页面布局数组 */
  pages: GroupPageLayout[];
  /** 总宽度 (= pageCount * pageWidth) */
  totalWidth: number;
  /** 单页宽度 */
  pageWidth: number;
  /** 列宽 */
  columnWidth: number;
  /** 总高度 (最大分组内容高度) — 用于纵向滚动边界 */
  totalHeight: number;
}

// ─── 默认宽高比 ──────────────────────────────────────

/** 缺失尺寸时的默认宽高比 (3:2) */
const DEFAULT_ASPECT_RATIO = 3 / 2;

// ─── 核心算法 ─────────────────────────────────────────

/**
 * 针对指定列数计算列宽（使用可用宽度）
 */
function computeColumnWidthForColumns(
  availableWidth: number,
  columns: number,
  config: LayoutConfig,
): number {
  const rawWidth = (availableWidth - config.gapX * (columns - 1)) / columns;

  if (columns === 1) {
    return Math.max(config.minColumnWidth, Math.min(rawWidth, config.maxSingleColumnWidth));
  }

  return Math.max(config.minColumnWidth, rawWidth);
}

/**
 * 计算指定列数下的列宽
 */
export function computeColumnWidth(
  viewportWidth: number,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): number {
  const availableWidth = viewportWidth - config.paddingX * 2;
  return computeColumnWidthForColumns(availableWidth, config.columns, config);
}

/**
 * 一次性全量计算水平分组布局
 *
 * 每个分组占据一个页面（pageWidth = viewportWidth），
 * 页面内使用瀑布流网格纵向排列，内容在页面内水平居中。
 * 算法复杂度: O(n)
 */
export function computeHorizontalLayout(
  groups: GroupData[],
  imageDimensions: Map<string, ImageDimension>,
  viewportWidth: number,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): LayoutResult {
  const pageWidth = viewportWidth;
  const availableWidth = pageWidth - config.paddingX * 2;
  const defaultColumnWidth = computeColumnWidthForColumns(availableWidth, config.columns, config);
  const allItems: LayoutItem[] = [];
  const groupTitles: GroupTitleItem[] = [];
  const pages: GroupPageLayout[] = [];
  let maxContentHeight = 0;

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const pageOffsetX = gi * pageWidth;

    // 根据分组图片数量动态调整列数
    const groupColumns = Math.min(group.pictureHashes.length || 1, config.columns);
    const groupColumnWidth = computeColumnWidthForColumns(availableWidth, groupColumns, config);

    // 计算内容块宽度并水平居中
    const contentBlockWidth = groupColumns * groupColumnWidth + (groupColumns - 1) * config.gapX;
    const contentOffsetX = pageOffsetX + (pageWidth - contentBlockWidth) / 2;

    // 列高度从顶部开始（无标题）
    const contentStartY = config.paddingTop;
    const columnHeights = new Array<number>(groupColumns).fill(contentStartY);

    // ── 分组标题（保留数据结构但不渲染） ──
    const titleItem: GroupTitleItem = {
      groupId: group.id,
      label: `${group.name}（${group.imageCount} 张）`,
      x: contentOffsetX,
      y: 0,
      width: contentBlockWidth,
      height: 0,
    };
    groupTitles.push(titleItem);

    const pageItems: LayoutItem[] = [];

    // ── 空分组 ──
    if (group.pictureHashes.length === 0) {
      pages.push({
        groupIndex: gi,
        groupId: group.id,
        offsetX: pageOffsetX,
        contentHeight: contentStartY,
        items: [],
        groupTitle: titleItem,
        sortedItems: [],
      });
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

      const x = contentOffsetX + shortestCol * (groupColumnWidth + config.gapX);
      const y = columnHeights[shortestCol];

      const item: LayoutItem = {
        hash,
        groupId: group.id,
        groupIndex: gi,
        x,
        y,
        width: groupColumnWidth,
        height: renderHeight,
      };

      pageItems.push(item);
      allItems.push(item);

      columnHeights[shortestCol] += renderHeight + config.gapY;
    }

    const contentHeight = Math.max(...columnHeights, 0) + config.paddingBottom;
    if (contentHeight > maxContentHeight) {
      maxContentHeight = contentHeight;
    }

    // 按 Y 排序用于组内虚拟化
    const sortedItems = [...pageItems].sort((a, b) => a.y - b.y);

    pages.push({
      groupIndex: gi,
      groupId: group.id,
      offsetX: pageOffsetX,
      contentHeight,
      items: pageItems,
      groupTitle: titleItem,
      sortedItems,
    });
  }

  const totalWidth = groups.length * pageWidth;

  return {
    items: allItems,
    groupTitles,
    pages,
    totalWidth,
    pageWidth,
    columnWidth: defaultColumnWidth,
    totalHeight: maxContentHeight,
  };
}

// ─── 旧接口兼容 ─────────────────────────────────────

/** @deprecated 使用 computeHorizontalLayout 代替 */
export function computeWaterfallLayout(
  groups: GroupData[],
  imageDimensions: Map<string, ImageDimension>,
  viewportWidth: number,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): LayoutResult {
  return computeHorizontalLayout(groups, imageDimensions, viewportWidth, config);
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
