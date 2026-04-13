// ============================================================
// 连续流网格布局引擎
//
// 所有图片按拍摄顺序连续排列为统一网格，不按分组分块。
// 分组信息通过首图角标传递（isFirstInGroup + groupLabel）。
// 列数根据画布宽度动态计算，限制 1-5 列。
//
// 接收分组数据 + 图片尺寸信息 + 视口尺寸，
// 一次性预计算所有图片的绝对坐标，供画布渲染和视口裁剪使用。
// ============================================================

import type { GroupData } from '../types';

// ─── 配置 ─────────────────────────────────────────────

/** 布局固定配置参数 */
export interface LayoutConfig {
  /** 缩略图基础尺寸 (px)，用于计算列数 */
  readonly thumbnailSize: number;
  /** 缩略图间距 (px) */
  readonly gap: number;
  /** 水平边距 (px) */
  readonly paddingX: number;
  /** 垂直边距 (px) */
  readonly paddingY: number;
  /** 分组之间的间距 (px) — 连续流模式下不再使用 */
  readonly groupGap: number;
  /** 分组标题高度 (px) — 连续流模式下不再使用 */
  readonly groupTitleHeight: number;
  /** 页面顶部内边距 (px) */
  readonly paddingTop: number;
  /** 页面底部内边距 (px) */
  readonly paddingBottom: number;
  /** 最大列数 */
  readonly maxColumns: number;
  /** 最小列数 */
  readonly minColumns: number;
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  thumbnailSize: 450,
  gap: 12,
  paddingX: 32,
  paddingY: 20,
  groupGap: 36,
  groupTitleHeight: 48,
  paddingTop: 56,     // 44px TopNavBar + 12px 安全距离
  paddingBottom: 84,   // 72px BottomFilmstrip + 12px 安全距离
  maxColumns: 5,
  minColumns: 1,
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
  /** 是否为该分组的第一张图（用于渲染分组角标） */
  isFirstInGroup: boolean;
  /** 分组角标文字（仅 isFirstInGroup=true 时有值） */
  groupLabel: string;
}

/** 分组标题布局信息 (保留用于接口兼容) */
export interface GroupTitleItem {
  groupId: number;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  compact?: boolean;
}

/** 单个分组页面的布局（用于虚拟化快速范围剔除） */
export interface GroupPageLayout {
  /** 分组在 groups 数组中的索引 */
  groupIndex: number;
  /** 分组 ID */
  groupId: number;
  /** 该分组第一张图片的纵向偏移 */
  offsetY: number;
  /** 该分组所有图片的总高度范围 */
  contentHeight: number;
  /** 统一列宽 (px) */
  columnWidth: number;
  /** 该分组包含的所有 LayoutItem */
  items: LayoutItem[];
  /** 分组标题（连续流模式下为 undefined） */
  groupTitle: GroupTitleItem | undefined;
  /** 按 Y 坐标排序的 LayoutItem 引用 (用于虚拟化) */
  sortedItems: LayoutItem[];
}

/** 完整的布局计算结果 */
export interface LayoutResult {
  /** 所有 LayoutItem（用于全局查询） */
  items: LayoutItem[];
  /** 分组标题（连续流模式下为空数组） */
  groupTitles: GroupTitleItem[];
  /** 分组页面布局数组（用于虚拟化和分组导航） */
  pages: GroupPageLayout[];
  /** 列宽（所有图片统一） */
  columnWidth: number;
  /** 总高度 */
  totalHeight: number;
}

// ─── 默认宽高比 ──────────────────────────────────────

/** 缺失尺寸时的默认宽高比 (3:2) */
const DEFAULT_ASPECT_RATIO = 3 / 2;

// ─── 核心算法 ─────────────────────────────────────────

/**
 * 计算列宽
 */
export function computeColumnWidth(
  viewportWidth: number,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): number {
  const columns = computeColumnCount(viewportWidth, config);
  return (viewportWidth - config.paddingX * 2 - config.gap * (columns - 1)) / columns;
}

/**
 * 计算列数（限制在 minColumns ~ maxColumns 之间）
 */
function computeColumnCount(
  viewportWidth: number,
  config: LayoutConfig,
): number {
  const raw = Math.floor(
    (viewportWidth - config.paddingX * 2 + config.gap) / (config.thumbnailSize + config.gap),
  );
  return Math.max(config.minColumns, Math.min(config.maxColumns, raw));
}

/**
 * 一次性全量计算连续流网格布局
 *
 * 所有分组的图片按顺序连续排列在统一网格中，
 * 每组首张图片标记 isFirstInGroup=true 和 groupLabel。
 * GroupPageLayout 保留用于虚拟化和分组导航。
 *
 * 算法复杂度: O(n)
 */
export function computeVerticalGridLayout(
  groups: GroupData[],
  imageDimensions: Map<string, ImageDimension>,
  viewportWidth: number,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): LayoutResult {
  const columns = computeColumnCount(viewportWidth, config);
  const columnWidth = (viewportWidth - config.paddingX * 2 - config.gap * (columns - 1)) / columns;
  const contentBlockWidth = columns * columnWidth + (columns - 1) * config.gap;
  const contentOffsetX = config.paddingX + (viewportWidth - config.paddingX * 2 - contentBlockWidth) / 2;

  const allItems: LayoutItem[] = [];
  const pages: GroupPageLayout[] = [];

  // ── 全局行状态（跨分组连续）──
  let colIdx = 0;
  let rowStartY = config.paddingTop;
  let rowMaxHeight = 0;
  /** 当前行中已放置的 item 数量（用于垂直居中回溯） */
  let rowItemCount = 0;

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    const groupLabel = `G${gi + 1} · ${group.imageCount}张`;

    // 跳过空分组
    if (group.pictureHashes.length === 0) {
      pages.push({
        groupIndex: gi,
        groupId: group.id,
        offsetY: rowStartY,
        contentHeight: 0,
        columnWidth,
        items: [],
        groupTitle: undefined,
        sortedItems: [],
      });
      continue;
    }

    const pageItems: LayoutItem[] = [];

    for (let hi = 0; hi < group.pictureHashes.length; hi++) {
      const hash = group.pictureHashes[hi];
      const dim = imageDimensions.get(hash);
      const aspectRatio = dim ? dim.width / dim.height : DEFAULT_ASPECT_RATIO;

      const renderWidth = columnWidth;
      const renderHeight = columnWidth / aspectRatio;

      const x = contentOffsetX + colIdx * (columnWidth + config.gap);
      const item: LayoutItem = {
        hash,
        groupId: group.id,
        groupIndex: gi,
        x,
        y: rowStartY, // 临时值，行结束时调整
        width: renderWidth,
        height: renderHeight,
        isFirstInGroup: hi === 0,
        groupLabel: hi === 0 ? groupLabel : '',
      };

      rowMaxHeight = Math.max(rowMaxHeight, renderHeight);
      allItems.push(item);
      pageItems.push(item);

      colIdx++;
      rowItemCount++;

      if (colIdx >= columns) {
        // 行结束，调整同行所有 item 的 Y 坐标（垂直居中）
        for (let i = allItems.length - rowItemCount; i < allItems.length; i++) {
          const rowItem = allItems[i];
          const yOffset = (rowMaxHeight - rowItem.height) / 2;
          rowItem.y = rowStartY + yOffset;
        }

        rowStartY += rowMaxHeight + config.gap;
        rowMaxHeight = 0;
        colIdx = 0;
        rowItemCount = 0;
      }
    }

    // 记录该分组的 page（offsetY 指向该分组第一张图片所在行的 Y）
    const firstItem = pageItems[0];
    const lastItem = pageItems[pageItems.length - 1];
    // offsetY 为该分组第一张图片的 y（可能还未通过垂直居中调整，取 allItems 中的值）
    const pageOffsetY = firstItem.y;
    // contentHeight 在所有行调整完毕后才能确定，先用临时值，后面修正
    const sortedItems = [...pageItems].sort((a, b) => a.y - b.y);

    pages.push({
      groupIndex: gi,
      groupId: group.id,
      offsetY: pageOffsetY,
      contentHeight: (lastItem.y + lastItem.height) - pageOffsetY,
      columnWidth,
      items: pageItems,
      groupTitle: undefined,
      sortedItems,
    });
  }

  // 处理最后一行（不足 columns 张）
  if (rowItemCount > 0) {
    for (let i = allItems.length - rowItemCount; i < allItems.length; i++) {
      const rowItem = allItems[i];
      const yOffset = (rowMaxHeight - rowItem.height) / 2;
      rowItem.y = rowStartY + yOffset;
    }
    rowStartY += rowMaxHeight;
  }

  // ── 修正所有 page 的 offsetY 和 contentHeight ──
  // 行垂直居中调整可能改变了 item.y，需要重新计算
  for (const page of pages) {
    if (page.items.length === 0) continue;

    let minY = Infinity;
    let maxBottom = -Infinity;
    for (const item of page.items) {
      minY = Math.min(minY, item.y);
      maxBottom = Math.max(maxBottom, item.y + item.height);
    }
    page.offsetY = minY;
    page.contentHeight = maxBottom - minY;

    // 重新排序 sortedItems（y 可能在垂直居中时变化）
    page.sortedItems = [...page.items].sort((a, b) => a.y - b.y);
  }

  const totalHeight = rowStartY + config.paddingBottom;

  return {
    items: allItems,
    groupTitles: [],
    pages,
    columnWidth,
    totalHeight: Math.max(0, totalHeight),
  };
}

// ─── 旧接口兼容 ─────────────────────────────────────

/** @deprecated 使用 computeVerticalGridLayout 代替 */
export const computeHorizontalLayout = computeVerticalGridLayout;

/** @deprecated 使用 computeVerticalGridLayout 代替 */
export function computeWaterfallLayout(
  groups: GroupData[],
  imageDimensions: Map<string, ImageDimension>,
  viewportWidth: number,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): LayoutResult {
  return computeVerticalGridLayout(groups, imageDimensions, viewportWidth, config);
}
